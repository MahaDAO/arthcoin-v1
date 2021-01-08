import chai, { expect } from 'chai';
import { ethers } from 'hardhat';
import { solidity } from 'ethereum-waffle';
import { Contract, ContractFactory, BigNumber, utils } from 'ethers';
import { Provider } from '@ethersproject/providers';

import { advanceTimeAndBlock } from './shared/utilities';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { ParamType } from 'ethers/lib/utils';
import { encodeParameters } from '../scripts/utils';


chai.use(solidity);


const DAY = 86400;
const ETH = utils.parseEther('1');
const ZERO_ADDR = '0x0000000000000000000000000000000000000000';
const BOARDROOM_LOCK_DURATION = 5 * 60;


async function latestBlocktime(provider: Provider): Promise<number> {
  const { timestamp } = await provider.getBlock('latest');
  return timestamp;
}


describe('Timelock', () => {
  const { provider } = ethers;

  let operator: SignerWithAddress;
  let abuser: SignerWithAddress;

  before('setup accounts', async () => {
    [operator, abuser] = await ethers.getSigners();
  });
  
  let UniswapV2Factory: ContractFactory;
  let UniswapV2Router02: ContractFactory;
  let BondRedemtionOracle: ContractFactory;
  let ARTHB: ContractFactory;
  let ARTH: ContractFactory;
  let MAHA: ContractFactory;
  let Timelock: ContractFactory;
  let Treasury: ContractFactory;
  let ARTHBoardroom: ContractFactory;
  let ARTHLiquidityBoardroom: ContractFactory;

  before('fetch contract factories', async () => {
    UniswapV2Factory = await ethers.getContractFactory('UniswapV2Factory');
    UniswapV2Router02 = await ethers.getContractFactory('UniswapV2Router02');
    BondRedemtionOracle = await ethers.getContractFactory('BondRedemtionOracle');
    ARTHB = await ethers.getContractFactory('ARTHB');
    ARTH = await ethers.getContractFactory('ARTH');
    MAHA = await ethers.getContractFactory('MahaToken');
    Timelock = await ethers.getContractFactory('Timelock');
    Treasury = await ethers.getContractFactory('Treasury');
    ARTHBoardroom = await ethers.getContractFactory('ArthBoardroom');
    ARTHLiquidityBoardroom = await ethers.getContractFactory('ArthLiquidityBoardroom');
  });
 
  let uniswap: Contract;
  let uniswapRouter: Contract;
  let bondRedemtionOracle: Contract;
  let bond: Contract;
  let cash: Contract;
  let share: Contract;
  let timelock: Contract;
  let treasury: Contract;
  let arthBoardroom: Contract;
  let arthLiquidityBoardroom: Contract;

  let startTime: number;

  beforeEach('Deploy contracts', async () => {
    uniswap = await UniswapV2Factory.connect(operator).deploy(operator.address);
    uniswapRouter = await UniswapV2Router02.connect(operator).deploy(uniswap.resolvedAddress, operator.address);
    bond = await ARTHB.connect(operator).deploy();
    cash = await ARTH.connect(operator).deploy();
    share = await MAHA.connect(operator).deploy();
    timelock = await Timelock.connect(operator).deploy(
      operator.address,
      2 * DAY
    );

    arthBoardroom = await ARTHBoardroom.connect(operator).deploy(
      cash.address,
      BOARDROOM_LOCK_DURATION
    );

    arthLiquidityBoardroom = await ARTHLiquidityBoardroom.connect(operator).deploy(
      cash.address,
      dai_arth_lpt_oracle,
      BOARDROOM_LOCK_DURATION
    )

    treasury = await Treasury.connect(operator).deploy(
      cash.address,
      bond.address,
      share.address,
      ZERO_ADDR,
      ZERO_ADDR,
      boardroom.address,
      ZERO_ADDR,
      (await latestBlocktime(provider)) + 5 * DAY
    );

    for await (const token of [cash, bond, share]) {
      await token.connect(operator).mint(treasury.address, ETH);
      await token.connect(operator).transferOperator(treasury.address);
      await token.connect(operator).transferOwnership(treasury.address);
    }
    await treasury.connect(operator).transferOperator(timelock.address);
    await treasury.connect(operator).transferOwnership(timelock.address);
    await boardroom.connect(operator).transferOperator(treasury.address);
    await boardroom.connect(operator).transferOwnership(timelock.address);

    startTime = Number(await treasury.getStartTime());
  });

  describe('#transferOperator', async () => {
    it('should work correctly', async () => {
      const eta = (await latestBlocktime(provider)) + 2 * DAY + 30;
      const signature = 'transferOperator(address)';
      const data = encodeParameters(ethers, ['address'], [operator.address]);
      const calldata = [boardroom.address, 0, signature, data, eta];
      const txHash = ethers.utils.keccak256(
        encodeParameters(
          ethers,
          ['address', 'uint256', 'string', 'bytes', 'uint256'],
          calldata
        )
      );

      await expect(timelock.connect(operator).queueTransaction(...calldata))
        .to.emit(timelock, 'QueueTransaction')
        .withArgs(txHash, ...calldata);

      await advanceTimeAndBlock(
        provider,
        eta - (await latestBlocktime(provider))
      );

      await expect(timelock.connect(operator).executeTransaction(...calldata))
        .to.emit(timelock, 'ExecuteTransaction')
        .withArgs(txHash, ...calldata)
        .to.emit(boardroom, 'OperatorTransferred')
        .withArgs(ZERO_ADDR, operator.address);

      expect(await boardroom.operator()).to.eq(operator.address);
    });
  });

  describe('#migrate', async () => {
    let newTreasury: Contract;

    beforeEach('deploy new treasury', async () => {
      newTreasury = await Treasury.connect(operator).deploy(
        cash.address,
        bond.address,
        share.address,
        ZERO_ADDR,
        ZERO_ADDR,
        boardroom.address,
        ZERO_ADDR,
        startTime
      );
    });

    it('should work correctly', async () => {
      const eta = (await latestBlocktime(provider)) + 2 * DAY + 30;
      const signature = 'migrate(address)';
      const data = encodeParameters(ethers, ['address'], [newTreasury.address]);
      const calldata = [treasury.address, 0, signature, data, eta];
      const txHash = ethers.utils.keccak256(
        encodeParameters(
          ethers,
          ['address', 'uint256', 'string', 'bytes', 'uint256'],
          calldata
        )
      );

      await expect(timelock.connect(operator).queueTransaction(...calldata))
        .to.emit(timelock, 'QueueTransaction')
        .withArgs(txHash, ...calldata);

      await advanceTimeAndBlock(
        provider,
        eta - (await latestBlocktime(provider))
      );

      await expect(timelock.connect(operator).executeTransaction(...calldata))
        .to.emit(timelock, 'ExecuteTransaction')
        .withArgs(txHash, ...calldata)
        .to.emit(treasury, 'Migration')
        .withArgs(newTreasury.address);

      for await (const token of [cash, bond, share]) {
        expect(await token.balanceOf(newTreasury.address)).to.eq(ETH);
        expect(await token.owner()).to.eq(newTreasury.address);
        expect(await token.operator()).to.eq(newTreasury.address);
      }

      expect(await latestBlocktime(provider)).to.lt(startTime);

      await advanceTimeAndBlock(
        provider,
        startTime - (await latestBlocktime(provider))
      );
    });
  });
});

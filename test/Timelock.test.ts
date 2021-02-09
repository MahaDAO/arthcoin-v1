import chai, { expect } from 'chai';
import { ethers } from 'hardhat';
import { solidity } from 'ethereum-waffle';
import { Contract, ContractFactory, BigNumber, utils } from 'ethers';
import { Provider } from '@ethersproject/providers';

import UniswapV2Factory from '@uniswap/v2-core/build/UniswapV2Factory.json';
import UniswapV2Router from '@uniswap/v2-periphery/build/UniswapV2Router02.json';

import { advanceTimeAndBlock } from './shared/utilities';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { encodeParameters } from '../scripts/utils';


chai.use(solidity);


const DAY = 86400;
const ETH = utils.parseEther('1');
const ZERO_ADDR = '0x0000000000000000000000000000000000000000';


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

  // Core.
  let ARTHB: ContractFactory;
  let ARTH: ContractFactory;
  let MAHA: ContractFactory;
  let Treasury: ContractFactory;
  let DevelopmentFund: ContractFactory;
  let ArthBoardroom: ContractFactory;
  let ArthLiquidityBoardroom: ContractFactory;
  let Oracle: ContractFactory;
  let Curve: ContractFactory;
  let DAI: ContractFactory;
  let Timelock: ContractFactory;
  let ArthMahaswapLiquidityBoardroom: ContractFactory;
  let MahaLiquidityBoardroom: ContractFactory;
  let RainyDayFund: ContractFactory;

  let Factory = new ContractFactory(
    UniswapV2Factory.abi,
    UniswapV2Factory.bytecode
  );
  let Router = new ContractFactory(
    UniswapV2Router.abi,
    UniswapV2Router.bytecode
  );

  before('Fetch contract factories', async () => {
    ARTHB = await ethers.getContractFactory('ARTHB');
    ARTH = await ethers.getContractFactory('ARTH');
    MAHA = await ethers.getContractFactory('MahaToken');
    Treasury = await ethers.getContractFactory('Treasury');
    DevelopmentFund = await ethers.getContractFactory('DevelopmentFund');
    ArthBoardroom = await ethers.getContractFactory('MockBoardroom');
    ArthMahaswapLiquidityBoardroom = await ethers.getContractFactory('MockBoardroom');
    ArthLiquidityBoardroom = await ethers.getContractFactory('MockBoardroom');
    MahaLiquidityBoardroom = await ethers.getContractFactory('MockBoardroom');
    Oracle = await ethers.getContractFactory('MockUniswapOracle');
    Curve = await ethers.getContractFactory('MockCurve');
    DAI = await ethers.getContractFactory('MockDai');
    Timelock = await ethers.getContractFactory('Timelock');
    RainyDayFund = await ethers.getContractFactory('RainyDayFund');
  });

  let startTime: BigNumber
  let bond: Contract;
  let cash: Contract;
  let share: Contract;
  let dai: Contract;
  let oracle: Contract;
  let arthBoardroom: Contract;
  let arthLiquidityBoardroom: Contract;
  let developmentFund: Contract;
  let arthMahaswapLiquidityBoardroom: Contract;

  let treasury: Contract;
  let uniswap: Contract;
  let uniswapRouter: Contract;
  let timelock: Contract;
  let mahaLiquidityBoardroom: Contract;
  let rainyDayFund: Contract;

  beforeEach('Deploy contracts', async () => {
    cash = await ARTH.connect(operator).deploy();
    bond = await ARTHB.connect(operator).deploy();
    share = await MAHA.connect(operator).deploy();
    dai = await DAI.connect(operator).deploy();

    startTime = BigNumber.from(await latestBlocktime(provider)).add(DAY);

    uniswap = await Factory.connect(operator).deploy(operator.address);
    uniswapRouter = await Router.connect(operator).deploy(uniswap.address, operator.address);

    await cash.connect(operator).approve(uniswapRouter.address, ETH.mul(10000));
    await share.connect(operator).approve(uniswapRouter.address, ETH.mul(10000));
    await bond.connect(operator).approve(uniswapRouter.address, ETH.mul(10000));
    await dai.connect(operator).approve(uniswapRouter.address, ETH.mul(10000));

    await share.connect(operator).mint(operator.address, ETH.mul(10));

    await uniswapRouter.connect(operator).addLiquidity(
      cash.address,
      dai.address,
      ETH.mul(1),
      ETH.mul(1),
      ETH.mul(1),
      ETH.mul(1),
      operator.address,
      BigNumber.from(await latestBlocktime(provider)).add(DAY)
    )

    developmentFund = await DevelopmentFund.connect(operator).deploy();
    rainyDayFund = await RainyDayFund.connect(operator).deploy();

    oracle = await Oracle.connect(operator).deploy();

    arthBoardroom = await ArthBoardroom.connect(operator).deploy(cash.address);
    arthLiquidityBoardroom = await ArthLiquidityBoardroom.connect(operator).deploy(
      cash.address
    );
    mahaLiquidityBoardroom = await MahaLiquidityBoardroom.connect(operator).deploy(
      cash.address
    );
    arthMahaswapLiquidityBoardroom = await ArthMahaswapLiquidityBoardroom.connect(operator).deploy(
      cash.address
    );

    treasury = await Treasury.connect(operator).deploy(
      dai.address,
      cash.address,
      bond.address,
      share.address,

      oracle.address,
      oracle.address,
      oracle.address,
      oracle.address,

      // arthLiquidityBoardroom.address,
      // arthMahaswapLiquidityBoardroom.address,
      // mahaLiquidityBoardroom.address,
      // arthBoardroom.address,

      // developmentFund.address,
      // rainyDayFund.address,
      uniswapRouter.address,
      startTime,
      5 * 60,
      0
    );

    // await developmentFund.connect(operator).transferOperator(treasury.address);
    // await cash.connect(operator).transferOperator(treasury.address);
    // await bond.connect(operator).transferOperator(treasury.address);
    // await arthBoardroom.connect(operator).transferOperator(treasury.address);
    // await arthLiquidityBoardroom.connect(operator).transferOperator(treasury.address);
    timelock = await Timelock.connect(operator).deploy(
      operator.address,
      2 * DAY
    );

    await share.connect(operator).mint(treasury.address, ETH);

    for await (const token of [cash, bond]) {
      await token.connect(operator).mint(treasury.address, ETH);
      await token.connect(operator).transferOperator(treasury.address);
      await token.connect(operator).transferOwnership(treasury.address);
    }

    await treasury.connect(operator).initializeFunds(
      arthLiquidityBoardroom.address,
      arthMahaswapLiquidityBoardroom.address,
      mahaLiquidityBoardroom.address,
      arthBoardroom.address,

      developmentFund.address,
      rainyDayFund.address
    )

    await treasury.connect(operator).transferOperator(timelock.address);
    await treasury.connect(operator).transferOwnership(timelock.address);

    await arthBoardroom.connect(operator).transferOperator(treasury.address);
    await arthBoardroom.connect(operator).transferOwnership(timelock.address);

    await arthLiquidityBoardroom.connect(operator).transferOperator(treasury.address);
    await arthLiquidityBoardroom.connect(operator).transferOwnership(timelock.address);

    await mahaLiquidityBoardroom.connect(operator).transferOperator(treasury.address);
    await mahaLiquidityBoardroom.connect(operator).transferOwnership(timelock.address);

    await arthMahaswapLiquidityBoardroom.connect(operator).transferOperator(treasury.address);
    await arthMahaswapLiquidityBoardroom.connect(operator).transferOwnership(timelock.address);
  });

  describe('#Migrate', async () => {
    let newTreasury: Contract;

    beforeEach('Deploy new treasury', async () => {
      newTreasury = await Treasury.connect(operator).deploy(
        dai.address,
        cash.address,
        bond.address,
        share.address,

        oracle.address,
        oracle.address,
        oracle.address,
        oracle.address,

        // arthLiquidityBoardroom.address,
        // arthMahaswapLiquidityBoardroom.address,
        // mahaLiquidityBoardroom.address,
        // arthBoardroom.address,

        // developmentFund.address,
        // rainyDayFund.address,
        uniswapRouter.address,
        startTime,
        5 * 60,
        0
      );

      await newTreasury.connect(operator).initializeFunds(
        arthLiquidityBoardroom.address,
        arthMahaswapLiquidityBoardroom.address,
        mahaLiquidityBoardroom.address,
        arthBoardroom.address,

        developmentFund.address,
        rainyDayFund.address
      )
    });

    it('Should work correctly', async () => {
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

      for await (const token of [cash, bond]) {
        expect(await token.balanceOf(newTreasury.address)).to.eq(ETH);
        expect(await token.owner()).to.eq(newTreasury.address);
        expect(await token.operator()).to.eq(newTreasury.address);
      }

      // expect(await latestBlocktime(provider)).to.lt(startTime);

      // await advanceTimeAndBlock(
      //   provider,
      //   Number(startTime) - (await latestBlocktime(provider))
      // );
    });
  });

  describe('#TransferOperator', async () => {
    it('Should work correctly for arth boardroom', async () => {
      const eta = (await latestBlocktime(provider)) + 2 * DAY + 30;
      const signature = 'transferOperator(address)';
      const data = encodeParameters(ethers, ['address'], [operator.address]);

      const calldata = [arthBoardroom.address, 0, signature, data, eta];
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
        .to.emit(arthBoardroom, 'OperatorTransferred')
        .withArgs(ZERO_ADDR, operator.address);

      expect(await arthBoardroom.operator()).to.eq(operator.address);
    });

    it('Should work correctly for arth liquidity boardroom', async () => {
      const eta = (await latestBlocktime(provider)) + 2 * DAY + 30;
      const signature = 'transferOperator(address)';
      const data = encodeParameters(ethers, ['address'], [operator.address]);

      const calldata = [arthLiquidityBoardroom.address, 0, signature, data, eta];
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
        .to.emit(arthLiquidityBoardroom, 'OperatorTransferred')
        .withArgs(ZERO_ADDR, operator.address);

      expect(await arthLiquidityBoardroom.operator()).to.eq(operator.address);
    });
  });
});

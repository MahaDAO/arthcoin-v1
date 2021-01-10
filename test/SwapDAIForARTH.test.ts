import chai, { expect } from 'chai';
import { ethers } from 'hardhat';
import { solidity } from 'ethereum-waffle';
import {
  Contract,
  ContractFactory,
  BigNumber,
  utils,
  BigNumberish,
} from 'ethers';
import { EtherscanProvider, Provider, showThrottleMessage } from '@ethersproject/providers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';

import { advanceTimeAndBlock } from './shared/utilities';


chai.use(solidity);


const DAY = 86400;
const ETH = utils.parseEther('1');
const ZERO = BigNumber.from(0);
const ZERO_ADDR = '0x0000000000000000000000000000000000000000';
const INITIAL_BAC_AMOUNT = utils.parseEther('50000');
const INITIAL_BAB_AMOUNT = utils.parseEther('50000');
const SWAP_DAI_AMOUNT = utils.parseEther('10000');


async function latestBlocktime(provider: Provider): Promise<number> {
  const { timestamp } = await provider.getBlock('latest');
  return timestamp;
}


function bigmin(a: BigNumber, b: BigNumber): BigNumber {
  return a.lt(b) ? a : b;
}


describe('SwapDAIForARTH', () => {
  const { provider } = ethers;

  let operator: SignerWithAddress;
  let ant: SignerWithAddress;

  before('Provider & accounts setting', async () => {
    [operator, ant] = await ethers.getSigners();
  });

  // Core.
  let ARTHB: ContractFactory;
  let ARTH: ContractFactory;
  let Oracle: ContractFactory;
  let SwapDAIForARTH: ContractFactory;
  let DAI: ContractFactory

  before('Fetch contract factories', async () => {
    ARTHB = await ethers.getContractFactory('ARTHB');
    ARTH = await ethers.getContractFactory('ARTH');
    Oracle = await ethers.getContractFactory('MockUniswapOracle');
    DAI = await ethers.getContractFactory('MockDai');
    SwapDAIForARTH = await ethers.getContractFactory('SwapDAIForARTH');
  });

  let bond: Contract;
  let cash: Contract;
  let dai: Contract;
  let oracle: Contract;
  let swapDaiForArth: Contract;

  beforeEach('Deploy contracts', async () => {
    cash = await ARTH.connect(operator).deploy();
    bond = await ARTHB.connect(operator).deploy();
    dai = await DAI.connect(operator).deploy();
    
    await cash.connect(operator).approve(operator.address, ETH.mul(10));
    await bond.connect(operator).approve(operator.address, ETH.mul(10));
    await dai.connect(operator).approve(operator.address, ETH.mul(10));

    oracle = await Oracle.connect(operator).deploy(
      cash.address,
      dai.address,
      5 * 60,
      Math.floor(Date.now() / 1000)
    );

    swapDaiForArth = await SwapDAIForARTH.connect(operator).deploy(
        dai.address,
        cash.address,
        bond.address,
        oracle.address,
        10,
        // uniswapRouter.address
    )
    
    await cash.connect(operator).transferOperator(operator.address);
    await bond.connect(operator).transferOperator(operator.address);
  }); 

  describe('Swap', async () => {
    beforeEach('Mint tokens', async () => {
      await cash.connect(operator).mint(ant.address, INITIAL_BAC_AMOUNT);
      await bond.connect(operator).mint(ant.address, INITIAL_BAB_AMOUNT);
      await dai.connect(operator).mint(ant.address, SWAP_DAI_AMOUNT);

      await dai.connect(ant).transfer(swapDaiForArth.address, SWAP_DAI_AMOUNT);
      // await dai.approve(uniswapRouter.address, SWAP_DAI_AMOUNT);
    });

    // describe('After minting', () => {
    //   it('Should pass', async () => {
    //     for await (const contract of [cash, bond, dai]) {
    //       await contract.connect(operator).transferOwnership(swapDaiForArth.address);
    //     }

    //     await treasury.connect(operator).migrate(operator.address);
    //     expect(await treasury.migrated()).to.be.true;

    //     await expect(treasury.buyBonds(ETH, ETH)).to.revertedWith(
    //       'Treasury: migrated'
    //     );
    //     await expect(treasury.redeemBonds(ETH, ETH)).to.revertedWith(
    //       'Treasury: migrated'
    //     );
    //   });
    // });
  });
});

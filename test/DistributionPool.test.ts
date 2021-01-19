import chai, { expect } from 'chai';
import { ethers } from 'hardhat';
import { solidity } from 'ethereum-waffle';
import {
  Contract,
  ContractFactory,
  BigNumber,
  utils,
  BigNumberish,
  ContractReceipt,
} from 'ethers';
import { EtherscanProvider, Provider, showThrottleMessage } from '@ethersproject/providers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';

import UniswapV2Factory from '@uniswap/v2-core/build/UniswapV2Factory.json';
import UniswapV2Router from '@uniswap/v2-periphery/build/UniswapV2Router02.json';

import { advanceTimeAndBlock } from './shared/utilities';


chai.use(solidity);


const DAY = 86400;
const ETH = utils.parseEther('1');
const ZERO = BigNumber.from(0);
const ZERO_ADDR = '0x0000000000000000000000000000000000000000';
const INITIAL_BAC_AMOUNT = utils.parseEther('50000');
const INITIAL_BAB_AMOUNT = utils.parseEther('50000');


async function latestBlocktime(provider: Provider): Promise<number> {
  const { timestamp } = await provider.getBlock('latest');
  return timestamp;
}


function bigmin(a: BigNumber, b: BigNumber): BigNumber {
  return a.lt(b) ? a : b;
}


describe('Distribution pools', () => {
  const { provider } = ethers;

  let operator: SignerWithAddress;
  let ant: SignerWithAddress;
  let whale: SignerWithAddress;

  before('provider & accounts setting', async () => {
    [operator, ant, whale] = await ethers.getSigners();
  });

  // Core.
  let ARTH: ContractFactory;
  let DAI: ContractFactory;
  let POOL: ContractFactory;
  let ARTHB: ContractFactory
  before('fetch contract factories', async () => {
    ARTHB = await ethers.getContractFactory('ARTHB');
    ARTH = await ethers.getContractFactory('ARTH');
    DAI = await ethers.getContractFactory('MockDai');
    POOL = await ethers.getContractFactory('ARTHTOKENPool');

  });

  let cash: Contract;
  let dai: Contract;
  let startTime: BigNumber;
  let pool: Contract;
  let bond: Contract;
  let poolSize: BigNumber = ETH.mul(1000);

  beforeEach('Deploy contracts', async () => {
    cash = await ARTH.connect(operator).deploy();
    dai = await DAI.connect(operator).deploy();
    startTime = BigNumber.from(await latestBlocktime(provider)).add(DAY);
    bond = await ARTHB.connect(operator).deploy();

    pool = await POOL.connect(operator).deploy(
      cash.address,
      dai.address,
      startTime,
      poolSize,
      false,
      'Test pool'
    );

    await cash.connect(operator).mint(operator.address, INITIAL_BAC_AMOUNT);
    await dai.connect(operator).mint(operator.address, INITIAL_BAB_AMOUNT);
  });

  describe('#setters', () => {
    it('should fail if not the owner', async () => {
      await expect(pool.connect(ant).changeToken(bond.address)).to.revertedWith(
        'Ownable: caller is not the owner'
      );

      await expect(pool.connect(ant).modifyMaxPoolSize(ETH.mul(2))).to.revertedWith(
        'Ownable: caller is not the owner'
      );

      await expect(pool.connect(ant).resetLimitingPoolSize()).to.revertedWith(
        'Ownable: caller is not the owner'
      );

      await expect(pool.connect(ant).setLimitingPoolSize()).to.revertedWith(
        'Ownable: caller is not the owner'
      );

      await expect(pool.connect(ant).modifyStartTime(startTime.add(DAY).add(DAY))).to.revertedWith(
        'Ownable: caller is not the owner'
      );

      await expect(pool.connect(ant).modifyRewardRate(2)).to.revertedWith(
        'Ownable: caller is not the owner'
      );

      await expect(pool.connect(ant).modifyPeriodFinish(startTime.add(DAY).add(DAY).add(DAY))).to.revertedWith(
        'Ownable: caller is not the owner'
      );

      await expect(pool.connect(ant).modifyDuration(5 * 60)).to.revertedWith(
        'Ownable: caller is not the owner'
      );

      await expect(pool.connect(ant).startPool()).to.revertedWith(
        'Ownable: caller is not the owner'
      );

      await expect(pool.connect(ant).endPool()).to.revertedWith(
        'Ownable: caller is not the owner'
      );

      await expect(pool.connect(ant).refundRewardToken()).to.revertedWith(
        'Ownable: caller is not the owner'
      );

      await expect(pool.connect(ant).refundStakedToken()).to.revertedWith(
        'Ownable: caller is not the owner'
      );
    });

    it('should work if tx sender is the owner', async () => {
      await expect(pool.connect(operator).changeToken(ZERO_ADDR)).to.revertedWith(
        'Pool: invalid token'
      );

      await expect(pool.connect(operator).modifyMaxPoolSize(ETH.mul(0))).to.revertedWith(
        'Pool: size of pool cannot be 0'
      );

      await expect(pool.connect(operator).modifyStartTime(startTime.mul(0))).to.revertedWith(
        'Pool: invalid start time'
      );

      await expect(pool.connect(operator).modifyRewardRate(-1)).to.revertedWith(
        'Pool: reward rate has to be positive'
      );

      await expect(pool.connect(operator).modifyRewardRate(101)).to.revertedWith(
        'Pool: reward rate has to be less than 100'
      );

      await expect(pool.connect(operator).modifyPeriodFinish(ZERO)).to.revertedWith(
        'Pool: period finish has to be bigger than 0'
      );

      await expect(pool.connect(operator).modifyPeriodFinish(BigNumber.from(await latestBlocktime(provider)).sub(DAY))).to.revertedWith(
        'Pool: cannot finish in the past time'
      );

      await expect(pool.connect(operator).modifyDuration(ZERO)).to.revertedWith(
        'Pool: duration has to be positive'
      );
    });

    it('should work if tx sender is the owner but params are not proper', async () => {
      expect(pool.connect(operator).changeToken(bond.address))
      expect(pool.connect(operator).modifyMaxPoolSize(ETH.mul(2)))
      expect(pool.connect(operator).resetLimitingPoolSize())
      expect(pool.connect(operator).setLimitingPoolSize())
      expect(pool.connect(operator).modifyStartTime(startTime.add(DAY).add(DAY)))
      expect(pool.connect(operator).modifyRewardRate(2))
      expect(pool.connect(operator).modifyPeriodFinish(startTime.add(DAY).add(DAY).add(DAY)))
      expect(pool.connect(operator).modifyDuration(5 * 60))
      expect(pool.connect(operator).startPool())
      expect(pool.connect(operator).endPool())
      expect(pool.connect(operator).refundRewardToken())
      expect(pool.connect(operator).refundStakedToken())
    });
  });

  describe('before startTime', () => {
    it('should fail if not started yet', async () => {
      await expect(pool.connect(ant).stake(ETH)).to.revertedWith(
        'Pool: not started'
      );

      await expect(pool.connect(ant).withdraw(ETH)).to.revertedWith(
        'Pool: not started'
      );

      await expect(pool.connect(ant).getReward()).to.revertedWith(
        'Pool: not started'
      );
    });
  });

  // describe('after startTime', () => {
  //   beforeEach('advance blocktime', async () => {
  //     // Wait til first epoch.
  //     await advanceTimeAndBlock(
  //       provider,
  //       startTime.sub(await latestBlocktime(provider)).toNumber()
  //     );
  //   });

  //   describe('#buyBonds', () => {
  //     it('should work if cash price below $1', async () => {
  //       const cashPrice = ETH.mul(99).div(100); // $0.99
  //       await oracle.setPrice(cashPrice);
  //       await oracle.setEpoch(1);

  //       // trigger updateConversionRate
  //       await treasury.allocateSeigniorage();

  //       await dai.connect(operator).transfer(ant.address, ETH);
  //       await dai.connect(ant).approve(treasury.address, ETH);
  //       await cash.connect(ant).approve(treasury.address, ETH);

  //       await expect(treasury.connect(ant).buyBonds(ETH, cashPrice))
  //         .to.emit(treasury, 'BoughtBonds')
  //         // TODO: calculate real numbers
  //         .withArgs(ant.address, ETH, BigNumber.from("906610893880149131"), BigNumber.from("915768579676918314"));

  //       expect(await dai.balanceOf(ant.address)).to.eq(ZERO);
  //       expect(await bond.balanceOf(ant.address)).to.eq(
  //         // TODO: calculate real numbers
  //         BigNumber.from("915768579676918314")
  //         // ETH.mul(ETH).div(cashPrice)
  //       );
  //     });

  //     it('should fail if cash price over $1', async () => {
  //       const cashPrice = ETH.mul(101).div(100); // $1.01
  //       await oracle.setPrice(cashPrice);

  //       await dai.connect(operator).transfer(ant.address, ETH);
  //       await dai.connect(ant).approve(treasury.address, ETH);
  //       await cash.connect(ant).approve(treasury.address, ETH);

  //       await expect(
  //         treasury.connect(ant).buyBonds(ETH, cashPrice)
  //       ).to.revertedWith(
  //         'Treasury: cashPrice not eligible for bond purchase'
  //       );
  //     });

  //     it('should fail if price changed', async () => {
  //       const cashPrice = ETH.mul(99).div(100); // $0.99
  //       await oracle.setPrice(cashPrice);

  //       await dai.connect(operator).transfer(ant.address, ETH);
  //       await dai.connect(ant).approve(treasury.address, ETH);
  //       await cash.connect(ant).approve(treasury.address, ETH);

  //       await expect(
  //         treasury.connect(ant).buyBonds(ETH, ETH.mul(98).div(100))
  //       ).to.revertedWith('Treasury: cash price moved');
  //     });

  //     it('should fail if purchase bonds with zero amount', async () => {
  //       const cashPrice = ETH.mul(99).div(100); // $0.99
  //       await oracle.setPrice(cashPrice);

  //       await expect(
  //         treasury.connect(ant).buyBonds(ZERO, cashPrice)
  //       ).to.revertedWith('Treasury: cannot purchase bonds with zero amount');
  //     });

  //     it('should update conversion limit', async () => {
  //       const cashPrice = ETH.mul(99).div(100);
  //       await oracle.setPrice(cashPrice);
  //       await oracle.setEpoch(1);

  //       await dai.connect(operator).transfer(ant.address, ETH);
  //       await dai.connect(ant).approve(treasury.address, ETH);
  //       await cash.connect(ant).approve(treasury.address, ETH);

  //       const getStatus = async () => ({
  //         lim: await treasury.cashToBondConversionLimit(),
  //         acc: await treasury.accumulatedBonds(),
  //       });

  //       let status;

  //       status = await getStatus();
  //       expect(status.lim).to.eq(0);
  //       expect(status.acc).to.eq(0);

  //       // trigger updateConversionRate
  //       await treasury.allocateSeigniorage();

  //       const circulatingSupply = await treasury.arthCirculatingSupply();
  //       await treasury.connect(ant).buyBonds(ETH, cashPrice);

  //       status = await getStatus();
  //       expect(status.lim).to.eq(
  //         circulatingSupply.mul(ETH.sub(cashPrice)).div(ETH)
  //       );
  //       // expect(status.acc).to.eq(ETH);
  //       // TODO: calculate real numbers
  //       expect(status.acc).to.eq(BigNumber.from("915768579676918314"));
  //     });

  //     it('should not purchase over conversion limit', async () => {
  //       const cashPrice = ETH.mul(99).div(100);
  //       await oracle.setPrice(cashPrice);
  //       await oracle.setEpoch(1);

  //       const circulatingSupply = await treasury.arthCirculatingSupply();
  //       const limit = circulatingSupply.mul(ETH.sub(cashPrice)).div(ETH);

  //       await dai.connect(operator).transfer(ant.address, limit.add(1));
  //       await dai.connect(ant).approve(treasury.address, limit.add(1));
  //       await cash.connect(ant).approve(treasury.address, limit.add(1));

  //       await expect(
  //         treasury.connect(ant).buyBonds(limit.add(1), cashPrice)
  //       ).to.revertedWith('No more bonds to be redeemed');
  //     });
  //   });
  // });
});

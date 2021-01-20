import chai, { expect } from 'chai';
import { ethers } from 'hardhat';
import { solidity } from 'ethereum-waffle';
import {
  Contract,
  ContractFactory,
  BigNumber,
  utils,
} from 'ethers';
import { Provider } from '@ethersproject/providers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';

import UniswapV2Factory from '@uniswap/v2-core/build/UniswapV2Factory.json';
import UniswapV2Router from '@uniswap/v2-periphery/build/UniswapV2Router02.json';

import { advanceTimeAndBlock } from './shared/utilities';


chai.use(solidity);


const DAY = 86400;
const ETH = utils.parseEther('1');
const ZERO = BigNumber.from(0);
const INITIAL_BAC_AMOUNT = utils.parseEther('50000');
const INITIAL_BAS_AMOUNT = utils.parseEther('10000');
const INITIAL_BAB_AMOUNT = utils.parseEther('50000');


async function latestBlocktime(provider: Provider): Promise<number> {
  const { timestamp } = await provider.getBlock('latest');
  return timestamp;
}


function bigmin(a: BigNumber, b: BigNumber): BigNumber {
  return a.lt(b) ? a : b;
}


describe('Treasury', () => {
  const { provider } = ethers;

  let operator: SignerWithAddress;
  let ant: SignerWithAddress;

  before('provider & accounts setting', async () => {
    [operator, ant] = await ethers.getSigners();
  });

  // Core.
  let ARTHB: ContractFactory;
  let ARTH: ContractFactory;
  let MAHA: ContractFactory;
  let Treasury: ContractFactory;
  let DevelopmentFund: ContractFactory;
  let MockBoardroom: ContractFactory;
  let MockOracle: ContractFactory;
  let DAI: ContractFactory;
  let MockCurve: ContractFactory;
  let period: number = 5 * 60


  let Factory = new ContractFactory(
    UniswapV2Factory.abi,
    UniswapV2Factory.bytecode
  );
  let Router = new ContractFactory(
    UniswapV2Router.abi,
    UniswapV2Router.bytecode
  );

  before('fetch contract factories', async () => {
    ARTHB = await ethers.getContractFactory('ARTHB');
    ARTH = await ethers.getContractFactory('ARTH');
    MAHA = await ethers.getContractFactory('MahaToken');
    Treasury = await ethers.getContractFactory('Treasury');
    DevelopmentFund = await ethers.getContractFactory('DevelopmentFund');
    MockBoardroom = await ethers.getContractFactory('MockBoardroom');
    MockCurve = await ethers.getContractFactory('MockCurve');
    MockOracle = await ethers.getContractFactory('MockOracle');
    DAI = await ethers.getContractFactory('MockDai');
  });

  let bond: Contract;
  let cash: Contract;
  let share: Contract;
  let dai: Contract;
  let curve: Contract;

  let oracle: Contract;
  let arthBoardroom: Contract;
  let arthLiquidityBoardroom: Contract;
  let developmentFund: Contract;
  let gmuOracle: Contract;
  let arthMahaOracle: Contract;
  let treasury: Contract;
  let startTime: BigNumber;
  let uniswap: Contract;
  let uniswapRouter: Contract;

  beforeEach('Deploy contracts', async () => {
    cash = await ARTH.connect(operator).deploy();
    bond = await ARTHB.connect(operator).deploy();
    share = await MAHA.connect(operator).deploy();
    dai = await DAI.connect(operator).deploy();
    curve = await MockCurve.connect(operator).deploy(
      utils.parseEther('1.05'),
      0,
      0,
      0,
      0
    );

    startTime = BigNumber.from(await latestBlocktime(provider)).add(DAY);

    uniswap = await Factory.connect(operator).deploy(operator.address);
    uniswapRouter = await Router.connect(operator).deploy(uniswap.address, operator.address);

    await cash.connect(operator).approve(uniswapRouter.address, ETH.mul(10000));
    await share.connect(operator).approve(uniswapRouter.address, ETH.mul(10000));
    await bond.connect(operator).approve(uniswapRouter.address, ETH.mul(10000));
    await dai.connect(operator).approve(uniswapRouter.address, ETH.mul(10000));

    await share.connect(operator).mint(operator.address, ETH.mul(10));
    await dai.connect(operator).mint(operator.address, ETH.mul(10));
    await cash.connect(operator).mint(operator.address, ETH.mul(10));

    await uniswapRouter.connect(operator).addLiquidity(
      cash.address,
      dai.address,
      ETH.mul(10),
      ETH.mul(10),
      ETH.mul(10),
      ETH.mul(10),
      operator.address,
      BigNumber.from(await latestBlocktime(provider)).add(DAY)
    )

    developmentFund = await DevelopmentFund.connect(operator).deploy();

    oracle = await MockOracle.connect(operator).deploy();

    gmuOracle = await MockOracle.connect(operator).deploy();
    arthMahaOracle = await MockOracle.connect(operator).deploy();

    arthBoardroom = await MockBoardroom.connect(operator).deploy(cash.address);
    arthLiquidityBoardroom = await MockBoardroom.connect(operator).deploy(cash.address);

    treasury = await Treasury.connect(operator).deploy(
      dai.address,
      cash.address,
      bond.address,
      share.address,
      oracle.address,
      arthMahaOracle.address,
      oracle.address,
      arthLiquidityBoardroom.address,
      arthBoardroom.address,
      developmentFund.address,
      uniswapRouter.address,
      curve.address,
      gmuOracle.address,
      startTime,
      period
    );
  });

  let newTreasury: Contract;

  beforeEach('Deploy new treasury', async () => {
    newTreasury = await Treasury.connect(operator).deploy(
      dai.address,
      cash.address,
      bond.address,
      share.address,
      oracle.address,
      arthMahaOracle.address,
      oracle.address,
      arthLiquidityBoardroom.address,
      arthBoardroom.address,
      developmentFund.address,
      uniswapRouter.address,
      curve.address,
      gmuOracle.address,
      startTime,
      period
    );
  });

  describe('Governance', () => {
    beforeEach('Deploy new treasury', async () => {
      await share.connect(operator).mint(treasury.address, ETH);

      for await (const token of [cash, bond]) {
        await token.connect(operator).mint(treasury.address, ETH);
        await token.connect(operator).transferOperator(treasury.address);
        await token.connect(operator).transferOwnership(treasury.address);
      }
      await arthBoardroom.connect(operator).transferOperator(treasury.address);
      await arthLiquidityBoardroom.connect(operator).transferOperator(treasury.address);
    });

    describe('#Initialize', () => {
      it('Should works correctly', async () => {
        await treasury.connect(operator).migrate(newTreasury.address);
        await arthBoardroom.connect(operator).transferOperator(newTreasury.address);
        await arthLiquidityBoardroom.connect(operator).transferOperator(newTreasury.address);

        await expect(newTreasury.initialize()).to.emit(
          newTreasury,
          'Initialized'
        );

        expect(await newTreasury.getReserve()).to.eq(ETH);
      });

      it('Should fail if newTreasury is not the operator of core arth boardroom contract', async () => {
        await arthBoardroom.connect(operator).transferOperator(ant.address);
        await expect(newTreasury.initialize()).to.revertedWith(
          'Treasury: need more permission'
        );
      });

      it('Should fail if newTreasury is not the operator of arth liquidity boardroom contract', async () => {
        await arthLiquidityBoardroom.connect(operator).transferOperator(ant.address);
        await expect(newTreasury.initialize()).to.revertedWith(
          'Treasury: need more permission'
        );
      });

      it('Should fail if abuser tries to initialize twice', async () => {
        await treasury.connect(operator).migrate(newTreasury.address);
        await arthBoardroom.connect(operator).transferOperator(newTreasury.address);
        await arthLiquidityBoardroom.connect(operator).transferOperator(newTreasury.address);

        await newTreasury.initialize();
        await expect(newTreasury.initialize()).to.revertedWith(
          'Treasury: initialized'
        );
      });
    });

    describe('#Migrate', () => {
      it('Should works correctly', async () => {
        await expect(treasury.connect(operator).migrate(newTreasury.address))
          .to.emit(treasury, 'Migration')
          .withArgs(newTreasury.address);

        for await (const token of [cash, bond]) {
          expect(await token.balanceOf(newTreasury.address)).to.eq(ETH);
          expect(await token.owner()).to.eq(newTreasury.address);
          expect(await token.operator()).to.eq(newTreasury.address);
        }

        expect(await share.balanceOf(newTreasury.address)).to.eq(ETH);
      });

      it('Should fail if treasury is not the operator of core contracts', async () => {
        await arthBoardroom.connect(operator).transferOperator(ant.address);
        await expect(
          treasury.connect(operator).migrate(newTreasury.address)
        ).to.revertedWith('Treasury: need more permission');
      });

      it('Should fail if treasury is not the operator of core contracts', async () => {
        await arthLiquidityBoardroom.connect(operator).transferOperator(ant.address);
        await expect(
          treasury.connect(operator).migrate(newTreasury.address)
        ).to.revertedWith('Treasury: need more permission');
      });

      it('should fail if already migrated', async () => {
        await treasury.connect(operator).migrate(newTreasury.address);
        await arthBoardroom.connect(operator).transferOperator(newTreasury.address);
        await arthLiquidityBoardroom.connect(operator).transferOperator(newTreasury.address);

        await newTreasury.connect(operator).migrate(treasury.address);
        await arthBoardroom.connect(operator).transferOperator(treasury.address);
        await arthLiquidityBoardroom.connect(operator).transferOperator(treasury.address);

        await expect(
          treasury.connect(operator).migrate(newTreasury.address)
        ).to.revertedWith('Treasury: migrated');
      });
    });
  });

  describe('Seigniorage', () => {
    describe('#allocateSeigniorage', () => {
      beforeEach('transfer permissions', async () => {
        await bond.mint(operator.address, INITIAL_BAB_AMOUNT);
        await cash.mint(operator.address, INITIAL_BAC_AMOUNT);
        await cash.mint(treasury.address, INITIAL_BAC_AMOUNT);
        await share.mint(operator.address, INITIAL_BAS_AMOUNT);
        for await (const contract of [cash, bond, arthLiquidityBoardroom, arthBoardroom]) {
          await contract.connect(operator).transferOperator(treasury.address);
        }
      });

      describe('after migration', () => {
        it('should fail if contract migrated', async () => {
          for await (const contract of [cash, bond]) {
            await contract
              .connect(operator)
              .transferOwnership(treasury.address);
          }

          await treasury.connect(operator).migrate(operator.address);
          expect(await treasury.migrated()).to.be.true;

          await expect(treasury.allocateSeigniorage()).to.revertedWith(
            'Treasury: migrated'
          );
        });
      });

      describe('before startTime', () => {
        it('should fail if not started yet', async () => {
          await expect(treasury.allocateSeigniorage()).to.revertedWith(
            'Epoch: not started yet'
          );
        });
      });

      describe('after startTime', () => {
        beforeEach('advance blocktime', async () => {
          // Wait til first epoch.
          await advanceTimeAndBlock(
            provider,
            startTime.sub(await latestBlocktime(provider)).toNumber()
          );
        });

        it('should not fund if price < targetPrice and inside lower band', async () => {
          const cashPrice = ETH.mul(98).div(100);
          await oracle.setPrice(cashPrice);

          const oldCashSupply = await cash.totalSupply();
          const oldCashBalanceOfAnt = await cash.balanceOf(ant.address);
          const oldCashBalanceOfTreasury = await cash.balanceOf(treasury.address);

          await expect(treasury.connect(ant).allocateSeigniorage()).to.not.emit(treasury, 'TreasuryFunded')

          expect(await cash.totalSupply()).to.eq(oldCashSupply.add(ETH.mul(200)));
          expect(await cash.balanceOf(ant.address)).to.eq(oldCashBalanceOfAnt.add(ETH.mul(200)));
          expect(await cash.balanceOf(treasury.address)).to.eq(oldCashBalanceOfTreasury);
        });

        it('should not fund if price < targetPrice and outside lower band', async () => {
          const cashPrice = ETH.mul(90).div(100);
          await oracle.setPrice(cashPrice);

          const oldCashSupply = await cash.totalSupply();
          const oldCashBalanceOfAnt = await cash.balanceOf(ant.address);
          const oldCashBalanceOfTreasury = await cash.balanceOf(treasury.address);

          await expect(treasury.connect(ant).allocateSeigniorage()).to.not.emit(treasury, 'TreasuryFunded')

          expect(await cash.totalSupply()).to.eq(oldCashSupply.add(ETH.mul(200)));
          expect(await cash.balanceOf(ant.address)).to.eq(oldCashBalanceOfAnt.add(ETH.mul(200)));
          expect(await cash.balanceOf(treasury.address)).to.eq(oldCashBalanceOfTreasury);
        });

        it('should not fund if price > targetPrice and outside upper band', async () => {
          const cashPrice = ETH.mul(90).div(100);
          await oracle.setPrice(cashPrice);

          const oldCashSupply = await cash.totalSupply();
          const oldCashBalanceOfAnt = await cash.balanceOf(ant.address);
          const oldCashBalanceOfTreasury = await cash.balanceOf(treasury.address);

          await expect(treasury.connect(ant).allocateSeigniorage()).to.not.emit(treasury, 'TreasuryFunded')

          expect(await cash.totalSupply()).to.eq(oldCashSupply.add(ETH.mul(200)));
          expect(await cash.balanceOf(ant.address)).to.eq(oldCashBalanceOfAnt.add(ETH.mul(200)));
          expect(await cash.balanceOf(treasury.address)).to.eq(oldCashBalanceOfTreasury);
        });

        it('should not fund if price > targetPrice and outside upper band but price < ceiling price', async () => {
          const cashPrice = ETH.mul(90).div(100);
          await oracle.setPrice(cashPrice);

          const oldCashSupply = await cash.totalSupply();
          const oldCashBalanceOfAnt = await cash.balanceOf(ant.address);
          const oldCashBalanceOfTreasury = await cash.balanceOf(treasury.address);

          await expect(treasury.connect(ant).allocateSeigniorage()).to.not.emit(treasury, 'TreasuryFunded')

          expect(await cash.totalSupply()).to.eq(oldCashSupply.add(ETH.mul(200)));
          expect(await cash.balanceOf(ant.address)).to.eq(oldCashBalanceOfAnt.add(ETH.mul(200)));
          expect(await cash.balanceOf(treasury.address)).to.eq(oldCashBalanceOfTreasury);
        });

        it('should fund if price > targetPrice but in the upper band and price > ceiling pric', async () => {
          const cashPrice = ETH.mul(103).div(100);
          await oracle.setPrice(cashPrice);

          await curve.setCeiling(ETH.mul(102).div(100));

          const oldCashSupply = await cash.totalSupply();
          const oldCashBalanceOfAnt = await cash.balanceOf(ant.address);
          const oldCashBalanceOfTreasury = await cash.balanceOf(treasury.address);

          // expect(await cash.totalSupply()).to.eq(oldCashSupply.add(ETH.mul(200)));
          // expect(await cash.balanceOf(ant.address)).to.eq(oldCashBalanceOfAnt.add(ETH.mul(200)));
          // expect(await cash.balanceOf(treasury.address)).to.eq(oldCashBalanceOfTreasury.add(ETH.mul(200)));

          const bondSeigniorageRate = await treasury.bondSeigniorageRate();

          // calculate with circulating supply
          const advanceReward = ETH.mul(200)
          const treasuryHoldings = await treasury.getReserve();
          const cashSupply = (await cash.totalSupply()).sub(treasuryHoldings).add(advanceReward);
          const expectedSeigniorage = cashSupply
            .mul(cashPrice.sub(ETH))
            .div(ETH);

          // get all expected reserve
          const expectedFundReserve = expectedSeigniorage
            .mul(await treasury.ecosystemFundAllocationRate())
            .div(100);

          const expectedTreasuryReserve = bigmin(
            expectedSeigniorage.sub(expectedFundReserve).mul(bondSeigniorageRate).div(100),
            (await bond.totalSupply()).sub(treasuryHoldings)
          );

          const expectedBoardroomReserve = expectedSeigniorage
            .sub(expectedFundReserve)
            .sub(expectedTreasuryReserve);

          const allocationResult = await treasury.allocateSeigniorage();

          if (expectedSeigniorage.gt(ZERO)) {
            await expect(new Promise((resolve) => resolve(allocationResult)))
              .to.emit(treasury, 'SeigniorageMinted')
              .withArgs(expectedSeigniorage);
          }

          if (expectedFundReserve.gt(ZERO)) {
            await expect(new Promise((resolve) => resolve(allocationResult)))
              .to.emit(treasury, 'PoolFunded')
              .withArgs(developmentFund.address, expectedFundReserve);
          }

          if (expectedTreasuryReserve.gt(ZERO)) {
            await expect(new Promise((resolve) => resolve(allocationResult)))
              .to.emit(treasury, 'TreasuryFunded')
              .withArgs(
                await latestBlocktime(provider),
                expectedTreasuryReserve
              );
          }

          // TODO: need to get the calcuation for the boardrooms correct
          if (expectedBoardroomReserve.gt(ZERO)) {
            // await expect(new Promise((resolve) => resolve(allocationResult)))
            //   .to.emit(treasury, 'PoolFunded')
            //   .withArgs(
            //     arthBoardroom.address,
            //     expectedBoardroomReserve
            //   );
          }

          expect(await cash.balanceOf(developmentFund.address)).to.eq(expectedFundReserve);
          expect(await treasury.getReserve()).to.eq(expectedTreasuryReserve);
          // expect(await cash.balanceOf(boardroom.address)).to.eq(
          //   expectedBoardroomReserve
          // );
        });

        // it('should funded even fails to call update function in oracle', async () => {
        //   const cashPrice = ETH.mul(106).div(100);
        //   await oracle.setRevert(true);
        //   await oracle.setPrice(cashPrice);

        //   expect(await treasury.allocateSeigniorage()).to.emit()
        // });

        it('should move to next epoch after allocation', async () => {
          const cashPrice1 = ETH.mul(106).div(100);
          await oracle.setPrice(cashPrice1);

          expect(await treasury.getNextEpoch()).to.eq(0);
          expect(await treasury.getLastEpoch()).to.eq(0);
          expect(await treasury.nextEpochPoint()).to.eq(startTime);

          await treasury.allocateSeigniorage();
          expect(await treasury.getNextEpoch()).to.eq(1);
          expect(await treasury.getLastEpoch()).to.eq(0);
          // expect(await treasury.nextEpochPoint()).to.eq(startTime.add(treasury.getPeriod()));

          await advanceTimeAndBlock(
            provider,
            Number(await treasury.nextEpochPoint()) -
            (await latestBlocktime(provider))
          );

          const cashPrice2 = ETH.mul(104).div(100);
          await oracle.setPrice(cashPrice2);

          await treasury.allocateSeigniorage();
          expect(await treasury.getNextEpoch()).to.eq(2);
          expect(await treasury.getLastEpoch()).to.eq(1);

          // TODO: uncomment this and get this to work
          // expect(await treasury.nextEpochPoint()).to.eq(startTime.add(treasury.getPeriod() * 2));
        });

        describe('should fail', () => {
          it('if treasury is not the operator of core contract', async () => {
            const cashPrice = ETH.mul(106).div(100);
            await oracle.setPrice(cashPrice);
            await oracle.setEpoch(1);

            for await (const target of [cash, bond, arthBoardroom, arthLiquidityBoardroom]) {
              await target.connect(operator).transferOperator(ant.address);
              await expect(treasury.allocateSeigniorage()).to.revertedWith(
                'Treasury: need more permission'
              );
            }
          });

          it('if seigniorage already allocated in this epoch', async () => {
            const cashPrice = ETH.mul(106).div(100);
            await oracle.setPrice(cashPrice);
            await oracle.setEpoch(1);

            await treasury.allocateSeigniorage();
            await expect(treasury.allocateSeigniorage()).to.revertedWith(
              'Epoch: not allowed'
            );
          });
        });
      });
    });
  });

  describe('bonds', async () => {
    beforeEach('transfer permissions', async () => {
      await cash.mint(operator.address, INITIAL_BAC_AMOUNT);
      await bond.mint(operator.address, INITIAL_BAB_AMOUNT);
      for await (const contract of [cash, bond, arthBoardroom, arthLiquidityBoardroom]) {
        await contract.connect(operator).transferOperator(treasury.address);
      }
    });

    describe('after migration', () => {
      it('should fail if contract migrated', async () => {
        for await (const contract of [cash, bond]) {
          await contract.connect(operator).transferOwnership(treasury.address);
        }

        await treasury.connect(operator).migrate(operator.address);
        expect(await treasury.migrated()).to.be.true;

        await expect(treasury.buyBonds(ETH, ETH)).to.revertedWith(
          'Treasury: migrated'
        );
        await expect(treasury.redeemBonds(ETH, false)).to.revertedWith(
          'Treasury: migrated'
        );
      });
    });

    describe('before startTime', () => {
      it('should fail if not started yet', async () => {
        await expect(treasury.buyBonds(ETH, ETH)).to.revertedWith(
          'Epoch: not started yet'
        );
        await expect(treasury.redeemBonds(ETH, false)).to.revertedWith(
          'Epoch: not started yet'
        );
      });
    });

    describe('after startTime', () => {
      beforeEach('advance blocktime', async () => {
        // wait til first epoch
        await advanceTimeAndBlock(
          provider,
          startTime.sub(await latestBlocktime(provider)).toNumber()
        );
      });

      describe('#buyBonds', () => {
        it('should not work if cash price below $1 and in band region', async () => {
          const cashPrice = ETH.mul(99).div(100); // $0.99
          await oracle.setPrice(cashPrice);
          await oracle.setEpoch(1);

          // trigger updateConversionRate
          await treasury.allocateSeigniorage();

          await dai.connect(operator).transfer(ant.address, ETH);
          await dai.connect(ant).approve(treasury.address, ETH);
          await cash.connect(ant).approve(treasury.address, ETH);

          await expect(treasury.connect(ant).buyBonds(ETH, cashPrice)).to.revertedWith(
            'Treasury: cashPrice not eligible for bond purchase'
          )

          expect(await dai.balanceOf(ant.address)).to.eq(ETH);
          expect(await bond.balanceOf(ant.address)).to.eq(ZERO);
        });

        it('should work if cash price below $1 and outside band region', async () => {
          const cashPrice = ETH.mul(90).div(100); // $0.99
          await oracle.setPrice(cashPrice);
          await oracle.setEpoch(1);

          // trigger updateConversionRate
          await treasury.allocateSeigniorage();

          await oracle.setPrice(cashPrice);

          await dai.connect(operator).transfer(ant.address, ETH);
          await dai.connect(ant).approve(treasury.address, ETH);
          await cash.connect(ant).approve(treasury.address, ETH);

          expect(treasury.connect(ant).buyBonds(ETH, cashPrice))

          expect(await dai.balanceOf(ant.address)).to.eq(ZERO);
          // TODO: use a proper number;
          expect(await bond.balanceOf(ant.address)).to.gt(ZERO);
        });

        // it('should work if bondConversionLimit < boughtBackAmount(not 0) and byy bonds', async () => {
        //   const cashPrice = ETH.mul(90).div(100); // $0.99
        //   await oracle.setPrice(cashPrice);
        //   await oracle.setEpoch(1);

        //   // trigger updateConversionRate
        //   await treasury.allocateSeigniorage();

        //   await dai.connect(operator).transfer(ant.address, ETH);
        //   await dai.connect(ant).approve(treasury.address, ETH);
        //   await cash.connect(ant).approve(treasury.address, ETH);

        //   expect(treasury.connect(ant).buyBonds(ETH, cashPrice))
        //   // .to.emit(treasury, 'BoughtBonds')
        //   // // TODO: calculate real numbers
        //   // .withArgs(ant.address, ETH, BigNumber.from("906610893880149131"), BigNumber.from("915768579676918314"));

        //   expect(await dai.balanceOf(ant.address)).to.eq(ZERO);
        //   // TODO: use a proper number;
        //   expect(await bond.balanceOf(ant.address)).to.gt(ZERO);
        // });

        it('should fail if cash price over $1 but inside band', async () => {
          const cashPrice = ETH.mul(101).div(100); // $1.01
          await oracle.setPrice(cashPrice);

          await dai.connect(operator).transfer(ant.address, ETH);
          await dai.connect(ant).approve(treasury.address, ETH);
          await cash.connect(ant).approve(treasury.address, ETH);

          await expect(
            treasury.connect(ant).buyBonds(ETH, cashPrice)
          ).to.revertedWith(
            'Treasury: cashPrice not eligible for bond purchase'
          );
        });

        it('should fail if cash price over $1 but update the conversion limit', async () => {
          const cashPrice = ETH.mul(110).div(100); // $1.01
          await oracle.setPrice(cashPrice);

          await dai.connect(operator).transfer(ant.address, ETH);
          await dai.connect(ant).approve(treasury.address, ETH);
          await cash.connect(ant).approve(treasury.address, ETH);

          await expect(treasury.connect(ant).buyBonds(ETH, cashPrice)).to.revertedWith(
            'Treasury: cashPrice not eligible for bond purchase'
          );;
        });

        it('should fail if price changed', async () => {
          const cashPrice = ETH.mul(99).div(100); // $0.99
          await oracle.setPrice(cashPrice);

          await dai.connect(operator).transfer(ant.address, ETH);
          await dai.connect(ant).approve(treasury.address, ETH);
          await cash.connect(ant).approve(treasury.address, ETH);

          await expect(
            treasury.connect(ant).buyBonds(ETH, ETH.mul(98).div(100))
          ).to.revertedWith('Treasury: cash price moved');
        });

        it('should fail if purchase bonds with zero amount', async () => {
          const cashPrice = ETH.mul(99).div(100); // $0.99
          await oracle.setPrice(cashPrice);

          await expect(
            treasury.connect(ant).buyBonds(ZERO, cashPrice)
          ).to.revertedWith('Treasury: cannot purchase bonds with zero amount');
        });

        it('should not update conversion limit if price is < but inside band', async () => {
          const cashPrice = ETH.mul(99).div(100);
          await oracle.setPrice(cashPrice);
          await oracle.setEpoch(1);

          await dai.connect(operator).transfer(ant.address, ETH);
          await dai.connect(ant).approve(treasury.address, ETH);
          await cash.connect(ant).approve(treasury.address, ETH);

          const getStatus = async () => ({
            lim: await treasury.cashToBondConversionLimit(),
            acc: await treasury.accumulatedBonds(),
          });

          const status = await getStatus();
          expect(status.lim).to.eq(0);
          expect(status.acc).to.eq(0);

          // trigger updateConversionRate
          await treasury.allocateSeigniorage();

          await expect(treasury.connect(ant).buyBonds(ETH, cashPrice)).to.revertedWith(
            'Treasury: cashPrice not eligible for bond purchase'
          );
          const newStatus = await getStatus();

          expect(status.lim).to.eq(newStatus.lim);
          expect(status.acc).to.eq(newStatus.acc);
        });

        it('should not update conversion limit if price is > but inside band', async () => {
          const cashPrice = ETH.mul(101).div(100);
          await oracle.setPrice(cashPrice);
          await oracle.setEpoch(1);

          await dai.connect(operator).transfer(ant.address, ETH);
          await dai.connect(ant).approve(treasury.address, ETH);
          await cash.connect(ant).approve(treasury.address, ETH);

          const getStatus = async () => ({
            lim: await treasury.cashToBondConversionLimit(),
            acc: await treasury.accumulatedBonds(),
          });

          const status = await getStatus();
          expect(status.lim).to.eq(0);
          expect(status.acc).to.eq(0);

          // trigger updateConversionRate
          await treasury.allocateSeigniorage();

          await expect(treasury.connect(ant).buyBonds(ETH, cashPrice)).to.revertedWith('Treasury: cashPrice not eligible for bond purchase');
          const newStatus = await getStatus();

          expect(status.lim).to.eq(newStatus.lim);
          expect(status.acc).to.eq(newStatus.acc);
        });

        it('should not update conversion limit if price is > but outside band', async () => {
          const cashPrice = ETH.mul(110).div(100);
          await oracle.setPrice(cashPrice);
          await oracle.setEpoch(1);

          await dai.connect(operator).transfer(ant.address, ETH);
          await dai.connect(ant).approve(treasury.address, ETH);
          await cash.connect(ant).approve(treasury.address, ETH);

          const getStatus = async () => ({
            lim: await treasury.cashToBondConversionLimit(),
            acc: await treasury.accumulatedBonds(),
          });

          const status = await getStatus();
          expect(status.lim).to.eq(0);
          expect(status.acc).to.eq(0);

          // trigger updateConversionRate
          await treasury.allocateSeigniorage();

          await expect(treasury.connect(ant).buyBonds(ETH, cashPrice)).to.revertedWith('Treasury: cashPrice not eligible for bond purchase');
          const newStatus = await getStatus();

          expect(newStatus.lim).to.eq(0);
          expect(status.acc).to.eq(newStatus.acc);
        });

        it('should update conversion limit if price < and outside band', async () => {
          const cashPrice = ETH.mul(90).div(100);
          await oracle.setPrice(cashPrice);
          await oracle.setEpoch(1);

          await dai.connect(operator).transfer(ant.address, ETH);
          await dai.connect(ant).approve(treasury.address, ETH);
          await cash.connect(ant).approve(treasury.address, ETH);

          const getStatus = async () => ({
            lim: await treasury.cashToBondConversionLimit(),
            acc: await treasury.accumulatedBonds(),
          });

          const status = await getStatus();
          expect(status.lim).to.eq(0);
          expect(status.acc).to.eq(0);

          // trigger updateConversionRate
          await treasury.allocateSeigniorage();

          expect(await treasury.connect(ant).buyBonds(ETH, cashPrice))
          const newStatus = await getStatus();

          expect(status.lim).to.not.eq(newStatus.lim);
          expect(status.acc).to.not.eq(newStatus.acc);
        });

        it('should not purchase over conversion limit', async () => {
          const cashPrice = ETH.mul(90).div(100);
          await oracle.setPrice(cashPrice);
          await oracle.setEpoch(1);

          const circulatingSupply = await treasury.arthCirculatingSupply();
          const limit = circulatingSupply.mul(ETH.sub(cashPrice)).div(ETH);

          await dai.connect(operator).transfer(ant.address, limit.add(1));
          await dai.connect(ant).approve(treasury.address, limit.add(1));
          await cash.connect(ant).approve(treasury.address, limit.add(1));

          await expect(
            treasury.connect(ant).buyBonds(limit.add(1), cashPrice)
          ).to.revertedWith('No more bonds to be redeemed');
        });

        // it('should not update conversion limit if storedEpoch = lastEpoch', async () => {
        //   const cashPrice = ETH.mul(90).div(100);
        //   await oracle.setPrice(cashPrice);
        //   await oracle.setEpoch(1);

        //   await cash.connect(operator).transfer(ant.address, ETH.mul(2));
        //   await cash.connect(ant).approve(treasury.address, ETH.mul(2));

        //   await dai.connect(operator).mint(ant.address, ETH.mul(2));
        //   await dai.connect(ant).approve(treasury.address, ETH);

        //   // trigger updateConversionRate
        //   await treasury.allocateSeigniorage();

        //   await treasury.connect(ant).buyBonds(ETH, cashPrice);

        //   expect(await oracle.lastBondOracleEpoch()).to.eq(1);

        //   const cashPrice2 = ETH.mul(90).div(100);
        //   await oracle.setPrice(cashPrice2);

        //   await treasury.connect(ant).buyBonds(ETH, cashPrice2);

        //   expect(await oracle.lastBondOracleEpoch()).to.eq(1);
        // });
      });

      describe('#redeemBonds', () => {
        beforeEach('allocate seigniorage to treasury', async () => {
          const cashPrice = ETH.mul(106).div(100);
          await oracle.setPrice(cashPrice);
          await treasury.allocateSeigniorage();
          await advanceTimeAndBlock(
            provider,
            Number(await treasury.nextEpochPoint()) -
            (await latestBlocktime(provider))
          );
        });

        it('should not work if amount is 0 and amount in dai is false', async () => {
          const cashPrice = ETH.mul(106).div(100);
          await oracle.setPrice(cashPrice);

          await bond.connect(operator).transfer(ant.address, ETH);
          await bond.connect(ant).approve(treasury.address, ETH);
          await share.connect(ant).approve(treasury.address, ETH);
          await share.connect(operator).mint(ant.address, ETH);

          await expect(treasury.connect(ant).redeemBonds(ZERO, false)).to.revertedWith(
            'Treasury: cannot redeem bonds with zero amount'
          );
        });

        it('should fail if redeem bonds with zero amount and amount in die is true', async () => {
          const cashPrice = ETH.mul(106).div(100);
          await oracle.setPrice(cashPrice);

          await expect(treasury.connect(ant).redeemBonds(ZERO, true)).to.revertedWith(
            'Treasury: cannot redeem bonds with zero amount'
          );
        });

        it('should not work if accumulated shares is 0', async () => {
          const cashPrice = ETH.mul(106).div(100);
          await oracle.setPrice(cashPrice);

          await bond.connect(operator).transfer(ant.address, ETH);
          await bond.connect(ant).approve(treasury.address, ETH);
          await share.connect(ant).approve(treasury.address, ETH);
          await share.connect(operator).mint(ant.address, ETH);
          await cash.connect(operator).transfer(treasury.address, ETH);

          const result = treasury.connect(ant).redeemBonds(ETH, false);

          await expect(new Promise((resolve) => resolve(result)))
            .to.emit(treasury, 'RedeemedBonds')
            .withArgs(ant.address, ZERO, false);

          await expect(new Promise((resolve) => resolve(result)))
            .to.emit(treasury, 'StabilityFeesCharged')
            .withArgs(ant.address, ZERO);

          expect(await bond.balanceOf(ant.address)).to.eq(ETH); // 1:1
          expect(await cash.balanceOf(ant.address)).to.eq(ZERO);
        });

        it('should work if accumulated shares != 0 and amount != 0', async () => {
          const cashPrice = ETH.mul(106).div(100);

          await oracle.setPrice(cashPrice);

          await bond.connect(operator).transfer(ant.address, ETH);
          await bond.connect(ant).approve(treasury.address, ETH);
          await share.connect(ant).approve(treasury.address, ETH);
          await share.connect(operator).mint(ant.address, ETH);
          await cash.connect(operator).transfer(treasury.address, ETH);

          const result = treasury.connect(ant).redeemBonds(ETH, false);

          await expect(new Promise((resolve) => resolve(result)))
            .to.emit(treasury, 'RedeemedBonds')
            .withArgs(ant.address, ETH, false);

          await expect(new Promise((resolve) => resolve(result)))
            .to.emit(treasury, 'StabilityFeesCharged')
            .withArgs(ant.address, ETH.mul(1).div(100));

          expect(await bond.balanceOf(ant.address)).to.eq(ZERO); // 1:1
          // expect(await cash.balanceOf(ant.address)).to.eq(ETH);
        });

        it("should drain over seigniorage and even contract's budget if accumulated seigniorage != 0 and amount != 0", async () => {
          const cashPrice = ETH.mul(106).div(100);
          await oracle.setPrice(cashPrice);

          await cash.connect(operator).transfer(treasury.address, ETH); // $1002

          const treasuryBalance = await cash.balanceOf(treasury.address);
          await bond.connect(operator).transfer(ant.address, treasuryBalance);
          await bond.connect(ant).approve(treasury.address, treasuryBalance);
          await share.connect(ant).approve(treasury.address, ETH.mul(1000));
          await share.connect(operator).mint(ant.address, ETH.mul(1000));

          const accumulatedSeigniorage = await treasury.accumulatedSeigniorage();

          const amount = bigmin(
            accumulatedSeigniorage,
            treasuryBalance
          )

          await expect(treasury.connect(ant).redeemBonds(treasuryBalance, false))
            .to.emit(treasury, 'RedeemedBonds')
            .withArgs(ant.address, amount, false)
            .to.emit(treasury, 'StabilityFeesCharged')
            .withArgs(ant.address, amount.mul(1).div(100));

          expect(await bond.balanceOf(ant.address)).to.eq(treasuryBalance.sub(amount));
          expect(await cash.balanceOf(ant.address)).to.eq(amount); // 1:1
        });

        it('should fail if cash price is below ceiling price', async () => {
          const cashPrice = ETH.mul(102).div(100);
          await oracle.setPrice(cashPrice);

          await bond.connect(operator).transfer(ant.address, ETH);
          await bond.connect(ant).approve(treasury.address, ETH);
          await expect(treasury.connect(ant).redeemBonds(ETH, false)).to.revertedWith(
            'Treasury: cashPrice less than ceiling'
          );
        });

        it("should fail if redeem bonds over contract's budget", async () => {
          const cashPrice = ETH.mul(106).div(100);
          await oracle.setPrice(cashPrice);

          const treasuryBalance = await cash.balanceOf(treasury.address);
          const redeemAmount = treasuryBalance.add(ETH);
          await bond.connect(operator).transfer(ant.address, redeemAmount);
          await bond.connect(ant).approve(treasury.address, redeemAmount);

          await expect(
            treasury.connect(ant).redeemBonds(redeemAmount, false)
          ).to.revertedWith('Treasury: treasury has not enough budget');
        });
      });
    });
  });
});

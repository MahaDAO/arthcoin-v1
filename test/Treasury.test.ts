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
  let BurnbackFund: ContractFactory;
  let DevelopmentFund: ContractFactory;
  let ArthBoardroom: ContractFactory;
  let ArthLiquidityBoardroom: ContractFactory;
  const TREASURY_PERIOD = 10 * 60;
  let BondRedemtionOracle: ContractFactory;
  let SeigniorageOracle: ContractFactory;
  let GMUOracle: ContractFactory;
  let MAHAUSDOracle: ContractFactory;
  let UniswapV2Factory: ContractFactory;
  let UniswapV2Router02: ContractFactory;
  let DAI: ContractFactory

  before('fetch contract factories', async () => {
    ARTHB = await ethers.getContractFactory('ARTHB');
    ARTH = await ethers.getContractFactory('ARTH');
    MAHA = await ethers.getContractFactory('MahaToken');
    Treasury = await ethers.getContractFactory('Treasury');
    BurnbackFund = await ethers.getContractFactory('BurnbackFund');
    DevelopmentFund = await ethers.getContractFactory('DevelopmentFund');
    ArthBoardroom = await ethers.getContractFactory('ArthBoardroom');
    ArthLiquidityBoardroom = await ethers.getContractFactory('ArthLiquidityBoardroom');
    BondRedemtionOracle = await ethers.getContractFactory('BondRedemtionOracle');
    SeigniorageOracle = await ethers.getContractFactory('SeigniorageOracle');
    GMUOracle = await ethers.getContractFactory('GMUOracle');
    MAHAUSDOracle = await ethers.getContractFactory('MAHAUSDOracle');
    UniswapV2Factory = await ethers.getContractFactory('UniswapV2Factory');
    UniswapV2Router02 = await ethers.getContractFactory('UniswapV2Router02');
    DAI = await ethers.getContractFactory('MockDai');
  });

  let bond: Contract;
  let cash: Contract;
  let share: Contract;
  let dai: Contract;
  let bondRedemtionOracle: Contract;
  let seigniorageOracle: Contract;
  let arthBoardroom: Contract;
  let arthLiquidityBoardroom: Contract;
  let burnbackFund: Contract;
  let developmentFund: Contract;
  let gmuOracle: Contract;
  let mahausdOracle: Contract;
  let treasury: Contract;
  let startTime: BigNumber;
  let uniswap: Contract;
  let uniswapRouter: Contract;

  beforeEach('deploy contracts', async () => {
    cash = await ARTH.connect(operator).deploy();
    bond = await ARTHB.connect(operator).deploy();
    share = await MAHA.connect(operator).deploy();
    dai = await DAI.connect(operator).deploy();

    uniswap = await UniswapV2Factory.connect(operator).deploy(operator.address);
    uniswapRouter = await UniswapV2Router02.connect(operator).deploy(uniswap.address, operator.address);
    
    await cash.connect(operator).approve(operator.address, ETH.mul(10));
    await share.connect(operator).approve(operator.address, ETH.mul(10));
    await bond.connect(operator).approve(operator.address, ETH.mul(10));
    await dai.connect(operator).approve(operator.address, ETH.mul(10));

    await share.connect(operator).mint(operator.address, ETH.mul(10));

    await uniswapRouter.connect(operator).addLiquidity(
      cash.address, 
      dai.address, 
      ETH.mul(10),
      ETH.mul(10),
      ETH.mul(10),
      ETH.mul(10),
      operator.address,
      Math.floor(Date.now() / 1000) + 30 * 60
    )
    
    burnbackFund = await BurnbackFund.connect(operator).deploy();
    await developmentFund.connect(operator).deploy();
    
    bondRedemtionOracle = await BondRedemtionOracle.connect(operator).deploy(
      uniswap.address,
      cash.address,
      dai.address,
      5 * 60,
      Math.floor(Date.now() / 1000)
    );

    seigniorageOracle = await SeigniorageOracle.connect(operator).deploy(
      uniswap.address,
      cash.address,
      dai.address,
      5 * 60,
      Math.floor(Date.now() / 1000)
    );

    gmuOracle = await GMUOracle.connect(operator).deploy('GMU', ETH);
    mahausdOracle = await MAHAUSDOracle.connect(operator).deploy('MAHA', ETH);

    arthBoardroom = await ArthBoardroom.connect(operator).deploy(cash.address, 5 * 60);
    const dai_arth_lpt = await await bondRedemtionOracle.pairFor(uniswap.address, cash.address, dai.address);
    arthLiquidityBoardroom = await ArthLiquidityBoardroom.connect(operator).deploy(
      cash.address,
      dai_arth_lpt,
      5 * 60
    );

    treasury = await Treasury.connect(operator).deploy(
      cash.address,
      bond.address,
      share.address,
      bondRedemtionOracle.address,
      mahausdOracle.address,
      seigniorageOracle.address,
      arthLiquidityBoardroom.address,
      arthBoardroom.address,
      developmentFund.address,
      burnbackFund.address,
      gmuOracle.address,
      Math.floor(Date.now() / 1000),
      5 * 60
    )
    
    await burnbackFund.connect(operator).transferOperator(treasury.address);
    await developmentFund.connect(operator).transferOperator(treasury.address);
    await cash.connect(operator).transferOperator(treasury.address);
    await bond.connect(operator).transferOperator(treasury.address);
    await arthBoardroom.connect(operator).transferOperator(treasury.address);
    await arthLiquidityBoardroom.connect(operator).transferOperator(treasury.address);
  });

  describe('governance', () => {
    let newTreasury: Contract;

    beforeEach('deploy new treasury', async () => {
      newTreasury = await Treasury.connect(operator).deploy(
        cash.address,
        bond.address,
        share.address,
        bondRedemtionOracle.address,
        mahausdOracle.address,
        seigniorageOracle.address,
        arthLiquidityBoardroom.address,
        arthBoardroom.address,
        developmentFund.address,
        burnbackFund.address,
        gmuOracle.address,
        Math.floor(Date.now() / 1000),
        5 * 60
      );

      for await (const token of [cash, bond, share]) {
        await token.connect(operator).mint(treasury.address, ETH);
        await token.connect(operator).transferOperator(treasury.address);
        await token.connect(operator).transferOwnership(treasury.address);
      }
      await arthBoardroom.connect(operator).transferOperator(treasury.address);
      await arthLiquidityBoardroom.connect(operator).transferOperator(treasury.address);
    });

    describe('#initialize', () => {
      it('Should works correctly', async () => {
        await treasury.connect(operator).migrate(newTreasury.address);
        await arthBoardroom.connect(operator).transferOperator(newTreasury.address);
        await arthLiquidityBoardroom.connect(operator).transferOperator(newTreasury.address);

        await expect(newTreasury.initialize())
          .to.emit(newTreasury, 'Initialized')
          .to.emit(cash, 'Transfer')
          .withArgs(newTreasury.address, ZERO_ADDR, ETH)
          .to.emit(cash, 'Transfer');

        expect(await newTreasury.getReserve()).to.eq(ZERO);
      });

      it('Should fail if newTreasury is not the operator of core contracts', async () => {
        await arthBoardroom.connect(operator).transferOperator(ant.address);
        await expect(newTreasury.initialize()).to.revertedWith(
          'Treasury: need more permission'
        );
      });

      it('Should fail if newTreasury is not the operator of core contracts', async () => {
        await arthLiquidityBoardroom.connect(operator).transferOperator(ant.address);
        await expect(newTreasury.initialize()).to.revertedWith(
          'Treasury: need more permission'
        );
      });

      it('Should fail if abuser tries to initialize twice', async () => {
        await treasury.connect(operator).migrate(newTreasury.address);
        await arthBoardroom.connect(operator).transferOperator(newTreasury.address);

        await newTreasury.initialize();
        await expect(newTreasury.initialize()).to.revertedWith(
          'Treasury: initialized'
        );
      });
    });

    describe('#migrate', () => {
      it('Should works correctly', async () => {
        await expect(treasury.connect(operator).migrate(newTreasury.address))
          .to.emit(treasury, 'Migration')
          .withArgs(newTreasury.address);

        for await (const token of [cash, bond, share]) {
          expect(await token.balanceOf(newTreasury.address)).to.eq(ETH);
          expect(await token.owner()).to.eq(newTreasury.address);
          expect(await token.operator()).to.eq(newTreasury.address);
        }
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

        await newTreasury.connect(operator).migrate(treasury.address);
        await arthBoardroom.connect(operator).transferOperator(treasury.address);

        await expect(
          treasury.connect(operator).migrate(newTreasury.address)
        ).to.revertedWith('Treasury: migrated');
      });
    });
  });

  describe('Seigniorage', () => {
    describe('#allocateSeigniorage', () => {
      beforeEach('Transfer permissions', async () => {
        await bond.mint(operator.address, INITIAL_BAB_AMOUNT);
        await cash.mint(operator.address, INITIAL_BAC_AMOUNT);
        await cash.mint(treasury.address, INITIAL_BAC_AMOUNT);
        await share.mint(operator.address, INITIAL_BAS_AMOUNT);
        
        for await (const contract of [cash, bond, share, arthBoardroom, arthLiquidityBoardroom]) {
          await contract.connect(operator).transferOperator(treasury.address);
        }
      });

      describe('After migration', () => {
        it('Should fail if contract migrated', async () => {
          for await (const contract of [cash, bond, share]) {
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

      describe('Before startTime', () => {
        it('Should fail if not started yet', async () => {
          await expect(treasury.allocateSeigniorage()).to.revertedWith(
            'Epoch: not started yet'
          );
        });
      });

      describe('After startTime', () => {
        beforeEach('Advance blocktime', async () => {
          // wait til first epoch
          await advanceTimeAndBlock(
            provider,
            startTime.sub(await latestBlocktime(provider)).toNumber()
          );
        });

        it('Should funded correctly', async () => {
          const cashPrice = ETH.mul(210).div(100);
          await gmuOracle.setPrice(cashPrice);

          // Calculate with circulating supply.
          const treasuryHoldings = await treasury.getReserve();
          const cashSupply = (await cash.totalSupply()).sub(treasuryHoldings);
          const expectedSeigniorage = cashSupply
            .mul(cashPrice.sub(ETH))
            .div(ETH);
          
          // To track updates to seigniorage.
          let updatedExpectedSeigniorage = expectedSeigniorage;

          // Get all expected fund reserve and update the expected seigniorage value.
          const expectedDevFundReserve = expectedSeigniorage
            .mul(await treasury.fundAllocationRate())
            .div(100);
          const expectedBurnbackFundReserve = expectedSeigniorage
            .mul(await treasury.fundAllocationRate())
            .div(100);
          updatedExpectedSeigniorage = expectedSeigniorage.sub(expectedBurnbackFundReserve).sub(expectedDevFundReserve);

          // Get all expected treasury reserve and update the expected seigniorage value.
          const expectedTreasuryReserve = bigmin(
            updatedExpectedSeigniorage,
            (await bond.totalSupply()).sub(treasuryHoldings)
          );
          updatedExpectedSeigniorage = updatedExpectedSeigniorage.sub(expectedTreasuryReserve);
          
          // Get all expected boardroom reserve and update the expected seigniorage value.
          const expectedArthBoardroomReserve = updatedExpectedSeigniorage
            .mul(await treasury.arthLiquidityBoardroomAllocationRate())
            .div(100);
          const expectedArthLiquidityBoardroomReserve = updatedExpectedSeigniorage
            .mul(await treasury.arthBoardroomAllocationRate())
            .div(100);
          updatedExpectedSeigniorage = updatedExpectedSeigniorage
            .sub(expectedArthBoardroomReserve)
            .sub(expectedArthLiquidityBoardroomReserve);

          // Get the new treasury seigniorage allocation.
          const allocationResult = await treasury.allocateSeigniorage();

          if (expectedDevFundReserve.gt(ZERO)) {
            await expect(new Promise((resolve) => resolve(allocationResult)))
              .to.emit(treasury, 'ContributionPoolFunded')
              .withArgs(await latestBlocktime(provider), expectedDevFundReserve);
          }

          if (expectedBurnbackFundReserve.gt(ZERO)) {
            await expect(new Promise((resolve) => resolve(allocationResult)))
              .to.emit(treasury, 'BurnBackPoolFunded')
              .withArgs(await latestBlocktime(provider), expectedBurnbackFundReserve);
          }

          if (expectedTreasuryReserve.gt(ZERO)) {
            await expect(new Promise((resolve) => resolve(allocationResult)))
              .to.emit(treasury, 'TreasuryFunded')
              .withArgs(
                await latestBlocktime(provider),
                expectedTreasuryReserve
              );
          }

          if (expectedArthBoardroomReserve.gt(ZERO)) {
            await expect(new Promise((resolve) => resolve(allocationResult)))
              .to.emit(treasury, 'BoardroomFunded')
              .withArgs(
                await latestBlocktime(provider),
                expectedArthBoardroomReserve
              );
          }

          if (expectedArthLiquidityBoardroomReserve.gt(ZERO)) {
            await expect(new Promise((resolve) => resolve(allocationResult)))
              .to.emit(treasury, 'BoardroomFunded')
              .withArgs(
                await latestBlocktime(provider),
                expectedArthLiquidityBoardroomReserve
              );
          }
          
          // They both have same fund allocation rate.
          expect(expectedDevFundReserve).to.eq(expectedBurnbackFundReserve);

          expect(await cash.balanceOf(developmentFund.address)).to.eq(expectedDevFundReserve);
          expect(await cash.balanceOf(burnbackFund.address)).to.eq(expectedBurnbackFundReserve);

          expect(await treasury.getReserve()).to.eq(expectedTreasuryReserve);
          
          expect(await cash.balanceOf(arthBoardroom.address)).to.eq(
            expectedArthBoardroomReserve
          );
          expect(await cash.balanceOf(arthLiquidityBoardroom.address)).to.eq(
            expectedArthLiquidityBoardroomReserve
          );
        });

        it('Should funded even fails to call update function in oracle', async () => {
          const cashPrice = ETH.mul(106).div(100);
          await gmuOracle.setPrice(cashPrice);

          await expect(treasury.allocateSeigniorage()).to.emit(
            treasury,
            'TreasuryFunded'
          );
        });

        it('Should move to next epoch after allocation', async () => {
          const cashPrice1 = ETH.mul(106).div(100);
          await gmuOracle.setPrice(cashPrice1);

          expect(await treasury.getCurrentEpoch()).to.eq(BigNumber.from(0));
          expect(await treasury.nextEpochPoint()).to.eq(startTime);

          await treasury.allocateSeigniorage();
          expect(await treasury.getCurrentEpoch()).to.eq(BigNumber.from(1));
          expect(await treasury.nextEpochPoint()).to.eq(startTime.add(DAY));

          await advanceTimeAndBlock(
            provider,
            Number(await treasury.nextEpochPoint()) -
            (await latestBlocktime(provider))
          );

          const cashPrice2 = ETH.mul(104).div(100);
          await gmuOracle.setPrice(cashPrice2);

          await treasury.allocateSeigniorage();
          expect(await treasury.getCurrentEpoch()).to.eq(BigNumber.from(2));
          expect(await treasury.nextEpochPoint()).to.eq(startTime.add(DAY * 2));
        });

        describe('Should fail', () => {
          it('If treasury is not the operator of core contract', async () => {
            const cashPrice = ETH.mul(106).div(100);
            await gmuOracle.setPrice(cashPrice);

            for await (const target of [cash, bond, share, arthBoardroom, arthLiquidityBoardroom]) {
              await target.connect(operator).transferOperator(ant.address);
              await expect(treasury.allocateSeigniorage()).to.revertedWith(
                'Treasury: need more permission'
              );
            }
          });

          it('If seigniorage already allocated in this epoch', async () => {
            const cashPrice = ETH.mul(106).div(100);
            await gmuOracle.setPrice(cashPrice);
            await treasury.allocateSeigniorage();
            await expect(treasury.allocateSeigniorage()).to.revertedWith(
              'Epoch: not allowed'
            );
          });
        });
      });
    });
  });

  describe('Bonds', async () => {
    beforeEach('Transfer permissions', async () => {
      await cash.mint(operator.address, INITIAL_BAC_AMOUNT);
      await bond.mint(operator.address, INITIAL_BAB_AMOUNT);
      for await (const contract of [cash, bond, share, arthBoardroom, arthLiquidityBoardroom]) {
        await contract.connect(operator).transferOperator(treasury.address);
      }
    });

    describe('After migration', () => {
      it('Should fail if contract migrated', async () => {
        for await (const contract of [cash, bond, share]) {
          await contract.connect(operator).transferOwnership(treasury.address);
        }

        await treasury.connect(operator).migrate(operator.address);
        expect(await treasury.migrated()).to.be.true;

        await expect(treasury.buyBonds(ETH, ETH)).to.revertedWith(
          'Treasury: migrated'
        );
        await expect(treasury.redeemBonds(ETH, ETH)).to.revertedWith(
          'Treasury: migrated'
        );
      });
    });

    describe('Before startTime', () => {
      it('Should fail if not started yet', async () => {
        await expect(treasury.buyBonds(ETH, ETH)).to.revertedWith(
          'Epoch: not started yet'
        );
        await expect(treasury.redeemBonds(ETH, ETH)).to.revertedWith(
          'Epoch: not started yet'
        );
      });
    });

    describe('After startTime', () => {
      beforeEach('Advance blocktime', async () => {
        // wait til first epoch
        await advanceTimeAndBlock(
          provider,
          startTime.sub(await latestBlocktime(provider)).toNumber()
        );
      });

      describe('#buyBonds', () => {
        it('Should work if cash price below $1', async () => {
          const cashPrice = ETH.mul(99).div(100); // $0.99
          await gmuOracle.setPrice(cashPrice);
          await cash.connect(operator).transfer(ant.address, ETH);
          await cash.connect(ant).approve(treasury.address, ETH);

          await expect(treasury.connect(ant).buyBonds(ETH, cashPrice))
            .to.emit(treasury, 'BoughtBonds')
            .withArgs(ant.address, ETH);

          expect(await cash.balanceOf(ant.address)).to.eq(ZERO);
          expect(await bond.balanceOf(ant.address)).to.eq(
            ETH.mul(ETH).div(cashPrice)
          );
        });

        it('Should fail if cash price over $1', async () => {
          const cashPrice = ETH.mul(101).div(100); // $1.01
          await gmuOracle.setPrice(cashPrice);
          await cash.connect(operator).transfer(ant.address, ETH);
          await cash.connect(ant).approve(treasury.address, ETH);

          await expect(
            treasury.connect(ant).buyBonds(ETH, cashPrice)
          ).to.revertedWith(
            'Treasury: cashPrice not eligible for bond purchase'
          );
        });

        it('Should fail if price changed', async () => {
          const cashPrice = ETH.mul(99).div(100); // $0.99
          await gmuOracle.setPrice(cashPrice);
          await cash.connect(operator).transfer(ant.address, ETH);
          await cash.connect(ant).approve(treasury.address, ETH);

          await expect(
            treasury.connect(ant).buyBonds(ETH, ETH)
          ).to.revertedWith('Treasury: cash price moved');
        });

        it('Should fail if purchase bonds with zero amount', async () => {
          const cashPrice = ETH.mul(99).div(100); // $0.99
          await gmuOracle.setPrice(cashPrice);

          await expect(
            treasury.connect(ant).buyBonds(ZERO, cashPrice)
          ).to.revertedWith('Treasury: cannot purchase bonds with zero amount');
        });
      });

      describe('#redeemBonds', () => {
        beforeEach('Allocate seigniorage to treasury', async () => {
          const cashPrice = ETH.mul(106).div(100);
          await gmuOracle.setPrice(cashPrice);
          await treasury.allocateSeigniorage();
          await advanceTimeAndBlock(
            provider,
            Number(await treasury.nextEpochPoint()) -
            (await latestBlocktime(provider))
          );
        });

        it('Should work if cash price exceeds $1.05', async () => {
          const cashPrice = ETH.mul(106).div(100);
          await gmuOracle.setPrice(cashPrice);

          await bond.connect(operator).transfer(ant.address, ETH);
          await bond.connect(ant).approve(treasury.address, ETH);
          await expect(treasury.connect(ant).redeemBonds(ETH, cashPrice))
            .to.emit(treasury, 'RedeemedBonds')
            .withArgs(ant.address, ETH);

          expect(await bond.balanceOf(ant.address)).to.eq(ZERO); // 1:1
          expect(await cash.balanceOf(ant.address)).to.eq(ETH);
        });

        it("Should drain over seigniorage and even contract's budget", async () => {
          const cashPrice = ETH.mul(106).div(100);
          await gmuOracle.setPrice(cashPrice);

          await cash.connect(operator).transfer(treasury.address, ETH); // $1002

          const treasuryBalance = await cash.balanceOf(treasury.address);
          await bond.connect(operator).transfer(ant.address, treasuryBalance);
          await bond.connect(ant).approve(treasury.address, treasuryBalance);
          await treasury.connect(ant).redeemBonds(treasuryBalance, cashPrice);

          expect(await bond.balanceOf(ant.address)).to.eq(ZERO);
          expect(await cash.balanceOf(ant.address)).to.eq(treasuryBalance); // 1:1
        });

        it('Should fail if price changed', async () => {
          const cashPrice = ETH.mul(106).div(100);
          await gmuOracle.setPrice(cashPrice);

          await bond.connect(operator).transfer(ant.address, ETH);
          await bond.connect(ant).approve(treasury.address, ETH);
          await expect(
            treasury.connect(ant).redeemBonds(ETH, ETH)
          ).to.revertedWith('Treasury: cash price moved');
        });

        it('Should fail if redeem bonds with zero amount', async () => {
          const cashPrice = ETH.mul(106).div(100);
          await gmuOracle.setPrice(cashPrice);

          await expect(
            treasury.connect(ant).redeemBonds(ZERO, cashPrice)
          ).to.revertedWith('Treasury: cannot redeem bonds with zero amount');
        });

        it('Should fail if cash price is below $1+ε', async () => {
          const cashPrice = ETH.mul(104).div(100);
          await gmuOracle.setPrice(cashPrice);

          await bond.connect(operator).transfer(ant.address, ETH);
          await bond.connect(ant).approve(treasury.address, ETH);
          await expect(
            treasury.connect(ant).redeemBonds(ETH, cashPrice)
          ).to.revertedWith(
            'Treasury: cashPrice not eligible for bond purchase'
          );
        });

        it("Should fail if redeem bonds over contract's budget", async () => {
          const cashPrice = ETH.mul(106).div(100);
          await gmuOracle.setPrice(cashPrice);

          const treasuryBalance = await cash.balanceOf(treasury.address);
          const redeemAmount = treasuryBalance.add(ETH);
          await bond.connect(operator).transfer(ant.address, redeemAmount);
          await bond.connect(ant).approve(treasury.address, redeemAmount);

          await expect(
            treasury.connect(ant).redeemBonds(redeemAmount, cashPrice)
          ).to.revertedWith('Treasury: treasury has no more budget');
        });
      });
    });
  });
});

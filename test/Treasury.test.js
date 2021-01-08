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
import { Provider } from '@ethersproject/providers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';

import { advanceTimeAndBlock } from './shared/utilities';

const ARTH = artifacts.require('ARTH');
const ARTHB = artifacts.require('ARTHB');
const MahaToken = artifacts.require('MahaToken');
const IERC20 = artifacts.require('IERC20');
const MockDai = artifacts.require('MockDai');
const DevelopmentFund = artifacts.require('DevelopmentFund');
const BurnbackFund = artifacts.require('BurnbackFund');
const BondRedemtionOracle = artifacts.require('BondRedemtionOracle');
const Treasury = artifacts.require('Treasury');
const ArthLiquidityBoardroom = artifacts.require('ArthLiquidityBoardroom');
const ArthBoardroom = artifacts.require('ArthBoardroom');
const GMUOracle = artifacts.require('GMUOracle');
const MAHAUSDOracle = artifacts.require('MAHAUSDOracle');
const SeigniorageOracle = artifacts.require('SeigniorageOracle');


chai.use(solidity);


const DAY = 86400;
const ETH = utils.parseEther('1');
const ZERO = BigNumber.from(0);
const ZERO_ADDR = '0x0000000000000000000000000000000000000000';
const INITIAL_ARTH_AMOUNT = utils.parseEther('50000');
const INITIAL_MAHA_AMOUNT = utils.parseEther('10000');
const INITIAL_ARTHB_AMOUNT = utils.parseEther('50000');


async function latestBlocktime(provider) {
  const { timestamp } = await provider.getBlock('latest');
  return timestamp;
}


function bigmin(a, b) {
  return a.lt(b) ? a : b;
}


contract ('Treasury', async () => {
  const { provider } = ethers;

  let operator;
  let ant;
  
  // Core accounts/addresses.
  let operatorAddress = null;
  let deployerAddress = process.env.WALLET_KEY;
  const userAddress2 = process.env.WALLET_KEY_2;
  const userAddress = operatorAddress;
  const operatorAddress2 = process.env.WALLET_KEY_3;
  
  // Core contract instances.
  let arthb;
  let arth;
  let maha;
  let treasury;
  let simpleFund;
  let mockOracle;
  let mockBoardroom;
  let bondRedemtionOralce;
  let mahausdOracle;
  let startTime = null;
  let seigniorageOracle;
  let arthLiquidityBoardroom;
  let arthBoardroom;
  let developmentFund;
  let burnbackFund;
  let gmuOracle;

  before('Fetching contracts', async () => {
    arthb = await ARTHB.deployed();
    arth = await ARTH.deployed();
    maha = await MAaha.deployed();
    treaury = await Treasury.deployed();
    simpleFund = await SimpleFund.deployed();
    mockOracle = await MockOracle.deployed();
    mockBoardroom = await MockBoardroom.deployed();
    bondRedemtionOralce = await BondRedemtionOracle.deployed();
    mahausdOracle = await MAHAUSDOracle.deployed();
    seigniorageOracle = await SeigniorageOracle.deployed();
    arthLiquidityBoardroom = await ArthLiquidityBoardroom.deployed();
    arthBoardroom = await ArthBoardroom.deployed();
    developmentFund = await DevelopmentFund.deployed();
    burnbackFund = await BurnbackFund.deployed();
    gmuOracle = await gmuOracle.deployed();
  });
 
  startTime = BigNumber.from(await latestBlocktime(provider)).add(DAY);

  describe('#initialize', () => {
    it('Should works correctly', async () => {
      await expect(treasury.initialize())
        .to.emit(treasury, 'Initialized')
        .to.emit(arth, 'Transfer')
        .withArgs(treasury.address, ZERO_ADDR, ETH)
        .to.emit(arth, 'Transfer');

      expect(await treasury.getReserve()).to.eq(ZERO);
    });

    it('Should fail if treasury is not the operator of core contracts', async () => {
      await arthBoardroom.connect(operatorAddress).transferOperator(operatorAddress2);
      
      await expect(treasury.initialize()).to.revertedWith(
        'Treasury: need more permission'
      );
    });

    it('Should fail if treasury is not the operator of core contracts', async () => {
      await arthLiquidityBoardroom.connect(operatorAddress).transferOperator(operatorAddress2);
      
      await expect(treasury.initialize()).to.revertedWith(
        'Treasury: need more permission'
      );
    });

    it('Should fail if abuser tries to initialize twice', async () => {
      await treasury.initialize();
      
      await expect(treasury.initialize()).to.revertedWith(
        'Treasury: initialized'
      );
    });
  });

  describe('#migrate', () => {
    let newTreasury =  null;

    beforeEach('Deploy new treasury', async () => {
      newTreasury = await Treasury.connect(operatorAddress).deploy(
        arth.address,
        arthb.address,
        maha.address,
        bondRedemtionOralce.address,
        mahausdOracle.address,
        seigniorageOracle.address,
        arthLiquidityBoardroom.address,
        arthBoardroom.address,
        developmentFund.address,
        burnbackFund.address,
        gmuOracle.address,
        await latestBlocktime(provider),
        2 * 60 // 2 mintues.
      );

      for await (const token of [arth, arthb, maha]) {
        await token.connect(operatorAddress).mint(treasury.address, ETH);
        await token.connect(operatorAddress).transferOperator(treasury.address);
        await token.connect(operatorAddress).transferOwnership(treasury.address);
      }

      await arthBoardroom.connect(operatorAddress).transferOperator(treasury.address);
      await arthLiquidityBoardroom.connect(operatorAddress).transferOperator(treasury.address);
    });
    
    it('Should works correctly', async () => {
      await expect(treasury.connect(operatorAddress).migrate(newTreasury.address))
        .to.emit(treasury, 'Migration')
        .withArgs(newTreasury.address);

        for await (const token of [arth, arthb, maha]) {
          expect(await token.balanceOf(newTreasury.address)).to.eq(ETH);
          expect(await token.owner()).to.eq(newTreasury.address);
          expect(await token.operator()).to.eq(newTreasury.address);
        }
    });

    it('Should fail if treasury is not the operator of core contracts', async () => {
      await arthBoardroom.connect(operatorAddress).transferOperator(operatorAddress2);
      
      await expect(
        treasury.connect(operatorAddress).migrate(newTreasury.address)
      ).to.revertedWith('Treasury: need more permission');
    });

    it('Should fail if treasury is not the operator of core contracts', async () => {
      await arthLiquidityBoardroom.connect(operatorAddress).transferOperator(operatorAddress2);
      
      await expect(
        treasury.connect(operatorAddress).migrate(newTreasury.address)
      ).to.revertedWith('Treasury: need more permission');
    });

    it('Should fail if already migrated', async () => {
      await treasury.connect(operatorAddress).migrate(newTreasury.address);
      await arthBoardroom.connect(operatorAddress).transferOperator(newTreasury.address);
      await arthLiquidityBoardroom.connect(operatorAddress).transferOperator(newTreasury.address);

      await newTreasury.connect(operatorAddress).migrate(treasury.address);
      await arthBoardroom.connect(operatorAddress).transferOperator(treasury.address);
      await arthLiquidityBoardroom.connect(operatorAddress).transferOperator(treasury.address);

      await expect(
        treasury.connect(operatorAddress).migrate(newTreasury.address)
      ).to.revertedWith('Treasury: migrated');
    });
  });
  
  // TODO POINT.
  describe('seigniorage', () => {
    describe('#allocateSeigniorage', () => {
      
        beforeEach('Transfer permissions', async () => {
        await arthb.mint(operatorAddress, INITIAL_ARTHB_AMOUNT);
        await arth.mint(operatorAddress, INITIAL_ARTH_AMOUNT);
        await arth.mint(treasuryAddress, INITIAL_ARTH_AMOUNT);
        await maha.mint(operatorAddress, INITIAL_MAHA_AMOUNT);
        
        for await (const contract of [arth, arthb, maha, arthBoardroom]) {
          await contract.connect(operatorAddress).transferOperator(treasury.address);
        }
      });

      describe('After migration', () => {
        it('Should fail if contract migrated', async () => {
          for await (const contract of [arth, arthb, maha]) {
            await contract
              .connect(operatorAddress)
              .transferOwnership(treasury.address);
          }

          await treasury.connect(operatorAddress).migrate(operatorAddress);
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
          // Wait till first epoch.
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
          const cashSupply = (await arth.totalSupply()).sub(treasuryHoldings);
          const expectedSeigniorage = cashSupply
            .mul(cashPrice.sub(ETH))
            .div(ETH);

          // Get all expected reserve.
          const expectedFundReserve = expectedSeigniorage
            .mul(await treasury.fundAllocationRate())
            .div(100);

          const expectedTreasuryReserve = bigmin(
            expectedSeigniorage.sub(expectedFundReserve),
            (await arthb.totalSupply()).sub(treasuryHoldings)
          );

          const expectedBoardroomReserve = expectedSeigniorage
            .sub(expectedFundReserve)
            .sub(expectedTreasuryReserve);

          const allocationResult = await treasury.allocateSeigniorage();

          if (expectedFundReserve.gt(ZERO)) {
            await expect(new Promise((resolve) => resolve(allocationResult)))
              .to.emit(treasury, 'ContributionPoolFunded')
              .withArgs(await latestBlocktime(provider), expectedFundReserve);
          }

          if (expectedTreasuryReserve.gt(ZERO)) {
            await expect(new Promise((resolve) => resolve(allocationResult)))
              .to.emit(treasury, 'TreasuryFunded')
              .withArgs(
                await latestBlocktime(provider),
                expectedTreasuryReserve
              );
          }

          if (expectedBoardroomReserve.gt(ZERO)) {
            await expect(new Promise((resolve) => resolve(allocationResult)))
              .to.emit(treasury, 'BoardroomFunded')
              .withArgs(
                await latestBlocktime(provider),
                expectedBoardroomReserve
              );
          }

          expect(await arth.balanceOf(fund.address)).to.eq(expectedFundReserve);
          expect(await treasury.getReserve()).to.eq(expectedTreasuryReserve);
          expect(await arth.balanceOf(boardroom.address)).to.eq(
            expectedBoardroomReserve
          );
        });

        // it('Should funded even fails to call update function in oracle', async () => {
        //   const cashPrice = ETH.mul(106).div(100);
        //   await gmuOracle.setRevert(true);
        //   await gmuOracle.setPrice(cashPrice);

        //   await expect(treasury.allocateSeigniorage()).to.emit(
        //     treasury,
        //     'TreasuryFunded'
        //   );
        // });

        it('should move to next epoch after allocation', async () => {
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

            for await (const target of [arth, arthb, maha, arthBoardroom]) {
              await target.connect(operatorAddress).transferOperator(operatorAddress2.address);
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
      await arth.mint(operatorAddress, INITIAL_ARTH_AMOUNT);
      await arthb.mint(operatorAddress, INITIAL_ARTHB_AMOUNT);
      
      for await (const contract of [arth, arthb, maha, arthBoardroom]) {
        await contract.connect(operatorAddress).transferOperator(treasury.address);
      }
    });

    describe('After migration', () => {
      it('Should fail if contract migrated', async () => {
        for await (const contract of [arth, arthb, maha]) {
          await contract.connect(operatorAddress).transferOwnership(treasury.address);
        }

        await treasury.connect(operatorAddress).migrate(operatorAddress);
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
        // Wait til first epoch.
        await advanceTimeAndBlock(
          provider,
          startTime.sub(await latestBlocktime(provider)).toNumber()
        );
      });

      describe('#buyBonds', () => {
        it('Should work if cash price below $1', async () => {
          const cashPrice = ETH.mul(99).div(100); // $0.99
          
          await gmuOracle.setPrice(cashPrice);
          await arth.connect(operatorAddress).transfer(operatorAddress2.address, ETH);
          await arth.connect(operatorAddress2).approve(treasury.address, ETH);

          await expect(treasury.connect(operatorAddress2).buyBonds(ETH, cashPrice))
            .to.emit(treasury, 'BoughtBonds')
            .withArgs(operatorAddress2, ETH);

          expect(await arth.balanceOf(operatorAddress2)).to.eq(ZERO);
          expect(await arthb.balanceOf(operatorAddress2)).to.eq(
            ETH.mul(ETH).div(cashPrice)
          );
        });

        it('Should fail if cash price over $1', async () => {
          const cashPrice = ETH.mul(101).div(100); // $1.01
          await gmuOracle.setPrice(cashPrice);
          
          await arth.connect(operatorAddress).transfer(operatorAddress2, ETH);
          await arth.connect(operatorAddress2).approve(treasury.address, ETH);

          await expect(
            treasury.connect(operatorAddress2).buyBonds(ETH, cashPrice)
          ).to.revertedWith(
            'Treasury: cashPrice not eligible for bond purchase'
          );
        });

        it('Should fail if price changed', async () => {
          const cashPrice = ETH.mul(99).div(100); // $0.99
          await gmuOracle.setPrice(cashPrice);

          await arth.connect(operatorAddress).transfer(operatorAddress2, ETH);
          await arth.connect(operatorAddress2).approve(treasury.address, ETH);

          await expect(
            treasury.connect(operatorAddress2).buyBonds(ETH, ETH)
          ).to.revertedWith('Treasury: cash price moved');
        });

        it('Should fail if purchase bonds with zero amount', async () => {
          const cashPrice = ETH.mul(99).div(100); // $0.99
          await gmuOracle.setPrice(cashPrice);

          await expect(
            treasury.connect(operatorAddress2).buyBonds(ZERO, cashPrice)
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

          await arthb.connect(operatorAddress).transfer(operatorAddress2, ETH);
          await arthb.connect(operatorAddress2).approve(treasury.address, ETH);

          await expect(treasury.connect(operatorAddress2).redeemBonds(ETH, cashPrice))
            .to.emit(treasury, 'RedeemedBonds')
            .withArgs(operatorAddress2, ETH);

          expect(await arthb.balanceOf(operatorAddress2)).to.eq(ZERO); // 1:1
          expect(await arth.balanceOf(operatorAddress2)).to.eq(ETH);
        });

        it("Should drain over seigniorage and even contract's budget", async () => {
          const cashPrice = ETH.mul(106).div(100);
          await gmuOracle.setPrice(cashPrice);

          await arth.connect(operatorAddress).transfer(treasury.address, ETH); // $1002

          const treasuryBalance = await arth.balanceOf(treasury.address);
          await arthb.connect(operatorAddress).transfer(operatorAddress2, treasuryBalance);
          await arthb.connect(operatorAddress2).approve(treasury.address, treasuryBalance);
          await treasury.connect(operatorAddress2).redeemBonds(treasuryBalance, cashPrice);

          expect(await arthb.balanceOf(operatorAddress2)).to.eq(ZERO);
          expect(await arth.balanceOf(operatorAddress2)).to.eq(treasuryBalance); // 1:1
        });

        it('Should fail if price changed', async () => {
          const cashPrice = ETH.mul(106).div(100);
          await gmuOracle.setPrice(cashPrice);

          await arthb.connect(operatorAddress).transfer(operatorAddress2, ETH);
          await arthb.connect(operatorAddress2).approve(treasury.address, ETH);
          await expect(
            treasury.connect(operatorAddress2).redeemBonds(ETH, ETH)
          ).to.revertedWith('Treasury: cash price moved');
        });

        it('Should fail if redeem bonds with zero amount', async () => {
          const cashPrice = ETH.mul(106).div(100);
          await gmuOracle.setPrice(cashPrice);

          await expect(
            treasury.connect(operatorAddress2).redeemBonds(ZERO, cashPrice)
          ).to.revertedWith('Treasury: cannot redeem bonds with zero amount');
        });

        it('Should fail if cash price is below $1+ε', async () => {
          const cashPrice = ETH.mul(104).div(100);
          await gmuOracle.setPrice(cashPrice);

          await arthb.connect(operatorAddress).transfer(ant.address, ETH);
          await arthb.connect(operatorAddress2).approve(treasury.address, ETH);
          
          await expect(
            treasury.connect(operatorAddress2).redeemBonds(ETH, cashPrice)
          ).to.revertedWith(
            'Treasury: cashPrice not eligible for bond purchase'
          );
        });

        it("Should fail if redeem bonds over contract's budget", async () => {
          const cashPrice = ETH.mul(106).div(100);
          await gmuOracle.setPrice(cashPrice);

          const treasuryBalance = await arth.balanceOf(treasury.address);
          const redeemAmount = treasuryBalance.add(ETH);
          await arthb.connect(operatorAddress).transfer(operatorAddress2, redeemAmount);
          await arthb.connect(operatorAddress2).approve(treasury.address, redeemAmount);

          await expect(
            treasury.connect(ant).redeemBonds(redeemAmount, cashPrice)
          ).to.revertedWith('Treasury: treasury has no more budget');
        });
      });
    });
  });
});

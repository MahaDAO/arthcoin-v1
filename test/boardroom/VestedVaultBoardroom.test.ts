import chai, { expect } from 'chai';
import { ethers } from 'hardhat';
import { solidity } from 'ethereum-waffle';
import { Contract, ContractFactory, BigNumber, utils } from 'ethers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';

import { advanceTimeAndBlock, latestBlocktime } from '../shared/utilities';
import { TREASURY_START_DATE } from '../../deploy.config';
// import { TREASURY_START_DATE } from '../../deploy.config';


chai.use(solidity);


describe('VestedVaultBoardroom', () => {
  // const DAY = 86400;

  const REWARDS_VESTING = 8 * 3600
  const BOARDROOM_LOCK_PERIOD = 5 * 60;
  const ETH = utils.parseEther('1');
  const ZERO = BigNumber.from(0);
  const STAKE_AMOUNT = ETH.mul(5000);
  const SEIGNIORAGE_AMOUNT = ETH.mul(10000);

  const { provider } = ethers;

  let operator: SignerWithAddress;
  let whale: SignerWithAddress;
  let abuser: SignerWithAddress;

  before('Provider & accounts setting', async () => {
    [operator, whale, abuser] = await ethers.getSigners();
  });

  let ARTH: ContractFactory;
  let VestedBondedBoardroom: ContractFactory;
  let SHARE: ContractFactory;
  let Vault: ContractFactory;

  before('Fetch contract factories', async () => {
    ARTH = await ethers.getContractFactory('ARTH');
    Vault = await ethers.getContractFactory('Vault');
    SHARE = await ethers.getContractFactory('MahaToken');
    VestedBondedBoardroom = await ethers.getContractFactory('VestedVaultBoardroom');
  });

  let cash: Contract;
  let share: Contract;
  let boardroom: Contract;
  let conBoardroom: Contract;
  let vault: Contract;

  beforeEach('Deploy contracts', async () => {
    cash = await ARTH.connect(operator).deploy();
    share = await SHARE.connect(operator).deploy();

    vault = await Vault.connect(operator).deploy(
      share.address,
      BOARDROOM_LOCK_PERIOD
    )
    boardroom = await VestedBondedBoardroom.connect(operator).deploy(
      cash.address,
      vault.address,
      REWARDS_VESTING
    );

    conBoardroom = await VestedBondedBoardroom.connect(operator).deploy(
      cash.address,
      vault.address,
      REWARDS_VESTING
    );

    vault.setBoardrooms(boardroom.address, conBoardroom.address);
  });

  describe('#Bond', () => {
    it('Should work correctly', async () => {
      await Promise.all([
        share.connect(operator).mint(whale.address, STAKE_AMOUNT),
        share.connect(whale).approve(vault.address, STAKE_AMOUNT),
      ]);

      await expect(vault.connect(whale).bond(STAKE_AMOUNT))
        .to.emit(vault, 'Bonded')
        .withArgs(whale.address, STAKE_AMOUNT);

      expect(await vault.balanceOf(whale.address)).to.eq(STAKE_AMOUNT);
    });

    it('Should fail when user tries to bond with zero amount', async () => {
      await expect(vault.connect(whale).bond(ZERO)).to.revertedWith(
        'Boardroom: cannot bond 0'
      );
    });

    it('Should fail when deposits are disabled', async () => {
      await vault.connect(operator).toggleDeposits(false);

      await expect(vault.connect(whale).bond(STAKE_AMOUNT)).to.revertedWith(
        'Boardroom: deposits are disabled'
      );
    });
  });

  describe('#Unbond', async () => {
    beforeEach('Should be able to stake', async () => {
      await Promise.all([
        share.connect(operator).mint(whale.address, STAKE_AMOUNT),
        share.connect(whale).approve(vault.address, STAKE_AMOUNT),
      ]);

      await vault.connect(whale).bond(STAKE_AMOUNT);
    });

    it('Should work', async () => {
      await expect(vault.connect(whale).unbond(STAKE_AMOUNT))
        .to.emit(vault, 'Unbonded')
        .withArgs(whale.address, STAKE_AMOUNT);

      expect(await share.balanceOf(whale.address)).to.eq(ZERO);
      expect(await vault.balanceOf(whale.address)).to.eq(STAKE_AMOUNT);
    });

    it('Should fail when user tries to ubond with zero amount', async () => {
      await advanceTimeAndBlock(
        provider,
        2 * BOARDROOM_LOCK_PERIOD
      );

      await expect(vault.connect(whale).unbond(ZERO)).to.revertedWith(
        'Boardroom: cannot unbond 0'
      );
    });

    it('Should fail when user tries to unbond more than staked amount', async () => {
      await advanceTimeAndBlock(
        provider,
        2 * BOARDROOM_LOCK_PERIOD
      );

      await expect(
        vault.connect(whale).unbond(STAKE_AMOUNT.add(1))
      ).to.revertedWith(
        'Boardroom: unbond request greater than staked amount'
      );
    });

    it('Should fail when non-director tries to withdraw', async () => {
      await advanceTimeAndBlock(
        provider,
        BOARDROOM_LOCK_PERIOD
      );

      await expect(vault.connect(abuser).unbond(ZERO)).to.revertedWith(
        'Boardroom: The director does not exist'
      );
    });
  });

  describe('#Withdraw', async () => {
    beforeEach('Should be able to stake', async () => {
      await Promise.all([
        share.connect(operator).mint(whale.address, STAKE_AMOUNT),
        share.connect(whale).approve(vault.address, STAKE_AMOUNT),
      ]);

      await vault.connect(whale).bond(STAKE_AMOUNT);
    });

    it('Should not be able to withdraw without unbonding and time < boardroomLockPeriod', async () => {
      await expect(vault.connect(whale).withdraw()).revertedWith('')

      expect(await share.balanceOf(whale.address)).to.eq(ZERO);
      expect(await vault.balanceOf(whale.address)).to.eq(STAKE_AMOUNT);
    });

    it('Should not be able to withdraw without unbonding and time > boardroomLockPeriod', async () => {
      await advanceTimeAndBlock(
        provider,
        2 * BOARDROOM_LOCK_PERIOD
      );

      await expect(vault.connect(whale).withdraw()).revertedWith('')

      expect(await share.balanceOf(whale.address)).to.eq(ZERO);
      expect(await vault.balanceOf(whale.address)).to.eq(STAKE_AMOUNT);
    });

    it('Should not be able to withdraw with unbonding and time < boardroomLockPeriod', async () => {
      await vault.connect(whale).unbond(STAKE_AMOUNT);

      await expect(vault.connect(whale).withdraw()).revertedWith('')

      expect(await share.balanceOf(whale.address)).to.eq(ZERO);
      expect(await vault.balanceOf(whale.address)).to.eq(STAKE_AMOUNT);
    });

    it('Should be able to withdraw with unbonding and time > boardroomLockPeriod', async () => {
      await vault.connect(whale).unbond(STAKE_AMOUNT);

      await advanceTimeAndBlock(
        provider,
        2 * BOARDROOM_LOCK_PERIOD
      );

      await expect(vault.connect(whale).withdraw())
        .to.emit(vault, 'Withdrawn')
        .withArgs(whale.address, STAKE_AMOUNT);

      expect(await share.balanceOf(whale.address)).to.eq(STAKE_AMOUNT);
      expect(await vault.balanceOf(whale.address)).to.eq(ZERO);
    });

    it('Should fail when non-director tries to withdraw', async () => {
      await advanceTimeAndBlock(
        provider,
        2 * BOARDROOM_LOCK_PERIOD
      );

      await expect(vault.connect(abuser).withdraw()).to.revertedWith(
        'Boardroom: The director does not exist'
      );
    });

    it('Should not be able to withdraw twice if only unbonded once', async () => {
      await vault.connect(whale).unbond(STAKE_AMOUNT);

      await advanceTimeAndBlock(
        provider,
        2 * BOARDROOM_LOCK_PERIOD
      );

      await expect(vault.connect(whale).withdraw())
        .to.emit(vault, 'Withdrawn')
        .withArgs(whale.address, STAKE_AMOUNT);

      expect(await share.balanceOf(whale.address)).to.eq(STAKE_AMOUNT);
      expect(await vault.balanceOf(whale.address)).to.eq(ZERO);

      await advanceTimeAndBlock(
        provider,
        2 * BOARDROOM_LOCK_PERIOD
      );

      await expect(vault.connect(whale).withdraw()).to.revertedWith(
        'Boardroom: The director does not exist'
      );
    });
  });


  describe('#AllocateSeigniorage', () => {
    beforeEach('Should be able to stake', async () => {
      await Promise.all([
        share.connect(operator).mint(whale.address, STAKE_AMOUNT),
        share.connect(whale).approve(vault.address, STAKE_AMOUNT),
      ]);

      await vault.connect(whale).bond(STAKE_AMOUNT);
    });

    it('Should allocate seigniorage to stakers', async () => {
      await cash.connect(operator).mint(operator.address, SEIGNIORAGE_AMOUNT);
      await cash
        .connect(operator)
        .approve(boardroom.address, SEIGNIORAGE_AMOUNT);

      await expect(
        boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT)
      )
        .to.emit(boardroom, 'RewardAdded')
        .withArgs(operator.address, SEIGNIORAGE_AMOUNT);

      expect(await boardroom.earned(whale.address)).to.eq(
        SEIGNIORAGE_AMOUNT
      );
    });

    it('Should fail when user tries to allocate with zero amount', async () => {
      await expect(
        boardroom.connect(operator).allocateSeigniorage(ZERO)
      ).to.revertedWith('Boardroom: Cannot allocate 0');
    });

    it('Should fail when non-operator tries to allocate seigniorage', async () => {
      await expect(
        boardroom.connect(abuser).allocateSeigniorage(ZERO)
      ).to.revertedWith('operator: caller is not the operator');
    });
  });

  describe('#ClaimReward', () => {
    beforeEach('Should be able to stake', async () => {
      await Promise.all([
        share.connect(operator).mint(whale.address, STAKE_AMOUNT),
        share.connect(whale).approve(vault.address, STAKE_AMOUNT),

        share.connect(operator).mint(abuser.address, STAKE_AMOUNT),
        share.connect(abuser).approve(vault.address, STAKE_AMOUNT),
      ]);

      await vault.connect(whale).bond(STAKE_AMOUNT);
    });

    it('Should claim vesting dividends if time < vestFor', async () => {
      await cash.connect(operator).mint(operator.address, SEIGNIORAGE_AMOUNT);
      await cash
        .connect(operator)
        .approve(boardroom.address, SEIGNIORAGE_AMOUNT);

      // This will get the really close timestamp of when we actually fund
      // the boardroom.
      const lastFundedOn = BigNumber.from(await latestBlocktime(provider));

      await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT);

      // Now, let's move 1hr after the funding happened.
      // This will help us check we get correct amount as per 1hr vesting.
      await advanceTimeAndBlock(
        provider,
        1 * 60 * 60
      );

      // NOTE: all mul and div from 1e18 are done for retaining
      // the precison

      // Calculate the time of block now when we are claiming.
      // This is really close to 1hr after funding the boardroom.
      const blockTime = BigNumber.from(await latestBlocktime(provider));
      // Calculate the time since funding, again ~1hour.
      const timeSinceLastFunding = blockTime.sub(lastFundedOn);
      // Calculate the ratio to reward as per time(current - (previousClaim or fundedTime)/vesting period).
      const timelyRewardRatio = timeSinceLastFunding.mul(ETH).div(await boardroom.vestFor());
      // Calcualte the reward per share.
      const rewardPerShare = SEIGNIORAGE_AMOUNT.mul(ETH).div(STAKE_AMOUNT);
      // According to reward per share and staked amount, calculate the earned rewards.
      const earnedReward = rewardPerShare.mul(STAKE_AMOUNT).div(ETH);
      // Now for vesting take calcuate the amount as per ratio we deserve.
      const expectedReward = earnedReward.mul(timelyRewardRatio).div(ETH);

      // NOTE: all mul and div from 1e18 are done for retaining
      // the precison
      await expect(boardroom.connect(whale).claimReward())
        .to.emit(boardroom, 'RewardPaid')
        .withArgs(whale.address, expectedReward);

      expect(await vault.balanceOf(whale.address)).to.eq(STAKE_AMOUNT);
      expect(await cash.balanceOf(whale.address)).to.gt(ZERO);
      expect(await share.balanceOf(whale.address)).to.eq(ZERO);
      expect(await cash.balanceOf(whale.address)).to.lt(SEIGNIORAGE_AMOUNT);
    });

    it('Should claim vesting dividends with equal amount if done in equal period(linear vesting) if time < vestFor', async () => {
      await cash.connect(operator).mint(operator.address, SEIGNIORAGE_AMOUNT);
      await cash
        .connect(operator)
        .approve(boardroom.address, SEIGNIORAGE_AMOUNT);
      // This will get the really close timestamp of when we actually fund
      // the boardroom.
      const lastFundedOn = BigNumber.from(await latestBlocktime(provider));

      await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT);

      // Now, let's move 1hr after the funding happened.
      // This will help us check we get correct amount as per 1hr vesting.
      await advanceTimeAndBlock(
        provider,
        1 * 60 * 60
      );

      // NOTE: all mul and div from 1e18 are done for retaining
      // the precison

      // Calculate the time of block now when we are claiming.
      // This is really close to 1hr after funding the boardroom.
      const blockTime = BigNumber.from(await latestBlocktime(provider));
      // Calculate the time since funding, again ~1hour.
      const timeSinceLastFunding = blockTime.sub(lastFundedOn);
      // Calculate the ratio to reward as per time(current - (previousClaim or fundedTime)/vesting period).
      const timelyRewardRatio = timeSinceLastFunding.mul(ETH).div(await boardroom.vestFor());
      // Calcualte the reward per share.
      const rewardPerShare = SEIGNIORAGE_AMOUNT.mul(ETH).div(STAKE_AMOUNT);
      // According to reward per share and staked amount, calculate the earned rewards.
      const earnedReward = rewardPerShare.mul(STAKE_AMOUNT).div(ETH);
      // Now for vesting take calcuate the amount as per ratio we deserve.
      const expectedReward = earnedReward.mul(timelyRewardRatio);

      // Calculate the time we are claiming.
      // This will be useful when we claim next time and we are in the vesting period.
      const lastClaimedOn = BigNumber.from(await latestBlocktime(provider));

      // NOTE: all mul and div from 1e18 are done for retaining
      // the precison
      await expect(boardroom.connect(whale).claimReward())
        .to.emit(boardroom, 'RewardPaid')
        .withArgs(whale.address, expectedReward.div(ETH));

      const rewardIn1Hr = await cash.balanceOf(whale.address);

      await advanceTimeAndBlock(
        provider,
        1 * 60 * 60
      );

      // Save the blocktime for when we are making another claim.
      // This is ~1hr after the first claim and ~2hr after the funding of boardroom.
      const blockTime2 = BigNumber.from(await latestBlocktime(provider));
      // Since, we have claimed once before calculate the time diff from when we claimed last.
      const timeSinceLastClaiming2 = blockTime2.sub(lastClaimedOn);
      // Accordingly calcualte the ratio of rewards we can take now, in the vesting period.
      const timelyRewardRatio2 = timeSinceLastClaiming2.mul(ETH).div(await boardroom.vestFor());

      // Calcualte the entire reward once again.
      const rewardPerShare2 = SEIGNIORAGE_AMOUNT.mul(ETH).div(STAKE_AMOUNT);
      const earnedReward2 = rewardPerShare2.mul(STAKE_AMOUNT).div(ETH);

      // Here we are subtracting the reward we claimed before, from the fresh and up to date
      // 100% of the rewards we deserve and then taking the ratio we calculated earlier.
      const expectedReward2 = earnedReward2.sub(expectedReward.div(ETH)).mul(timelyRewardRatio2);

      await expect(boardroom.connect(whale).claimReward())
        .to.emit(boardroom, 'RewardPaid')
        .withArgs(whale.address, expectedReward2.div(ETH));

      expect(await vault.balanceOf(whale.address)).to.eq(STAKE_AMOUNT);
      expect(await cash.balanceOf(whale.address)).to.gt(rewardIn1Hr);
      expect(await share.balanceOf(whale.address)).to.eq(ZERO);
      expect(await cash.balanceOf(whale.address)).to.lt(SEIGNIORAGE_AMOUNT);

      // Reward should decrease linearly with increasing time in vesting period.
      // Hence when we claim with same interval as the first, we should not receive
      // the exact amount.
      expect(await cash.balanceOf(whale.address)).to.lt(rewardIn1Hr.mul(2));
    });

    it('Should claim vesting devidends correctly even after time > vestFor', async () => {
      await cash.connect(operator).mint(operator.address, SEIGNIORAGE_AMOUNT);
      await cash
        .connect(operator)
        .approve(boardroom.address, SEIGNIORAGE_AMOUNT);
      await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT);

      await advanceTimeAndBlock(
        provider,
        8 * 60 * 60
      );

      await expect(boardroom.connect(whale).claimReward())
        .to.emit(boardroom, 'RewardPaid');

      expect(await share.balanceOf(whale.address)).to.eq(ZERO);
      // As there is only one time fund allocation, and only one staker
      // the staker should get entire rewards generated till now.
      expect(await cash.balanceOf(whale.address)).to.eq(SEIGNIORAGE_AMOUNT);
      expect(await vault.balanceOf(whale.address)).to.eq(STAKE_AMOUNT);
    });

    it('Should claim vesting dividends if time < vestFor even after other person stakes after snapshot', async () => {
      await cash.connect(operator).mint(operator.address, SEIGNIORAGE_AMOUNT);
      await cash
        .connect(operator)
        .approve(boardroom.address, SEIGNIORAGE_AMOUNT);
      // This will get the really close timestamp of when we actually fund
      // the boardroom.
      const lastFundedOn = BigNumber.from(await latestBlocktime(provider));

      await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT);

      // Now, let's move 1hr after the funding happened.
      // This will help us check we get correct amount as per 1hr vesting.
      await advanceTimeAndBlock(
        provider,
        1 * 60 * 60
      );

      // Abuser has also taken part in the distribution now
      // however this should not change the rewards for whale.
      await vault.connect(abuser).bond(STAKE_AMOUNT);

      // NOTE: all mul and div from 1e18 are done for retaining
      // the precison

      // Calculate the time of block now when we are claiming.
      // This is really close to 1hr after funding the boardroom.
      const blockTime = BigNumber.from(await latestBlocktime(provider));
      // Calculate the time since funding, again ~1hour.
      const timeSinceLastFunding = blockTime.sub(lastFundedOn);
      // Calculate the ratio to reward as per time(current - (previousClaim or fundedTime)/vesting period).
      const timelyRewardRatio = timeSinceLastFunding.mul(ETH).div(await boardroom.vestFor());
      // Calcualte the reward per share.
      const rewardPerShare = SEIGNIORAGE_AMOUNT.mul(ETH).div(STAKE_AMOUNT);
      // According to reward per share and staked amount, calculate the earned rewards.
      const earnedReward = rewardPerShare.mul(STAKE_AMOUNT).div(ETH);
      // Now for vesting take calcuate the amount as per ratio we deserve.
      const expectedReward = earnedReward.mul(timelyRewardRatio);

      // Calculate the time we are claiming.
      // This will be useful when we claim next time and we are in the vesting period.
      const lastClaimedOn = BigNumber.from(await latestBlocktime(provider));

      // NOTE: all mul and div from 1e18 are done for retaining
      // the precison
      await expect(boardroom.connect(whale).claimReward())
        .to.emit(boardroom, 'RewardPaid')
        .withArgs(whale.address, expectedReward.div(ETH));

      expect(await vault.balanceOf(whale.address)).to.eq(STAKE_AMOUNT);
      expect(await vault.balanceOf(abuser.address)).to.eq(STAKE_AMOUNT);
      expect(await cash.balanceOf(whale.address)).to.gt(ZERO);
      expect(await cash.balanceOf(abuser.address)).to.eq(ZERO);
      expect(await share.balanceOf(abuser.address)).to.eq(ZERO);
      expect(await share.balanceOf(whale.address)).to.eq(ZERO);
      expect(await cash.balanceOf(whale.address)).to.lt(SEIGNIORAGE_AMOUNT);
    });

    it('Should claim vesting devidends correctly even after time > vestFor even after other person stakes after snapshot', async () => {
      await cash.connect(operator).mint(operator.address, SEIGNIORAGE_AMOUNT);
      await cash
        .connect(operator)
        .approve(boardroom.address, SEIGNIORAGE_AMOUNT);
      await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT);

      await vault.connect(abuser).bond(STAKE_AMOUNT);

      await advanceTimeAndBlock(
        provider,
        8 * 60 * 60
      );

      await expect(boardroom.connect(whale).claimReward())
        .to.emit(boardroom, 'RewardPaid')
        .withArgs();

      expect(await share.balanceOf(whale.address)).to.eq(ZERO);
      expect(await cash.balanceOf(abuser.address)).to.eq(ZERO);
      expect(await share.balanceOf(abuser.address)).to.eq(ZERO);
      expect(await cash.balanceOf(whale.address)).to.eq(SEIGNIORAGE_AMOUNT);
      expect(await vault.balanceOf(whale.address)).to.eq(STAKE_AMOUNT);
      expect(await vault.balanceOf(abuser.address)).to.eq(STAKE_AMOUNT);
    });
  });

  describe('#earned', () => {
    beforeEach('Should be able to stake', async () => {
      await Promise.all([
        share.connect(operator).mint(whale.address, STAKE_AMOUNT),
        share.connect(whale).approve(vault.address, STAKE_AMOUNT),

        share.connect(operator).mint(abuser.address, STAKE_AMOUNT),
        share.connect(abuser).approve(vault.address, STAKE_AMOUNT),
      ]);

      await vault.connect(whale).bond(STAKE_AMOUNT);
    });

    describe("allocateSeigniorage() is not yet called", async () => {
      it('should not earn anything if not bonded anything', async () => {
        await expect(boardroom.connect(abuser).claimReward())
          .to.revertedWith('Boardroom: The director does not exist')
      });

      it('should not earn anything even if bonded anything', async () => {
        await expect(boardroom.connect(whale).claimReward())
          .to.not.revertedWith('Boardroom: The director does not exist')
          .to.not.emit(boardroom, 'RewardPaid');
      });
    })

    describe("I bond at the first epoch", async () => {
      beforeEach('allocateSeigniorage()', async () => {
        await cash.connect(operator).mint(operator.address, SEIGNIORAGE_AMOUNT);
        await cash.connect(operator).approve(boardroom.address, SEIGNIORAGE_AMOUNT);
      });

      describe("allocateSeigniorage() allocates 100% of the supply once", async () => {
        it('should not earn anything if not bonded anything', async () => {
          await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT)

          await expect(boardroom.connect(abuser).claimReward())
            .to.revertedWith('Boardroom: The director does not exist')
        });

        it('should not earn anything if bonded after the allocateSeigniorage() call', async () => {
          const oldCashBalanceOfAbuser = await cash.balanceOf(abuser.address);
          await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT)

          await vault.connect(abuser).bond(STAKE_AMOUNT);
          await advanceTimeAndBlock(
            provider,
            8 * 60 * 60
          );

          await expect(boardroom.connect(abuser).claimReward())
            .to.not.emit(boardroom, 'RewardPaid')

          expect(await cash.balanceOf(abuser.address)).to.eq(oldCashBalanceOfAbuser)
        });

        describe("claimReward called once", async () => {
          it('Should not earn anything if bonded but then withdrew everything', async () => {
            const oldCashBalanceOfWhale = await cash.balanceOf(whale.address);
            await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT)

            await expect(vault.connect(whale).unbond(STAKE_AMOUNT))
              .to.emit(vault, 'Unbonded')
              .withArgs(whale.address, STAKE_AMOUNT)

            await advanceTimeAndBlock(
              provider,
              BOARDROOM_LOCK_PERIOD
            );

            await expect(vault.connect(whale).withdraw())
              .to.emit(vault, 'Withdrawn')
              .withArgs(whale.address, STAKE_AMOUNT)

            expect(await vault.connect(whale).balanceOf(whale.address)).to.eq(0);

            await expect(boardroom.connect(whale).claimReward())
              .to.revertedWith('Boardroom: The director does not exist')

            expect(await cash.balanceOf(whale.address)).to.eq(oldCashBalanceOfWhale)
          });

          it('Should earn 100% after 8 hrs if i\'m the only person bonding in the pool', async () => {
            const oldCashBalanceOfWhale = await cash.balanceOf(whale.address);
            await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT)

            await advanceTimeAndBlock(
              provider,
              8 * 60 * 60
            );

            await expect(boardroom.connect(whale).claimReward())
              .to.emit(boardroom, 'RewardPaid')
              .withArgs(whale.address, SEIGNIORAGE_AMOUNT)

            expect(await share.balanceOf(whale.address)).to.eq(ZERO);
            expect(await vault.balanceOf(whale.address)).to.eq(STAKE_AMOUNT);
            expect(await cash.balanceOf(whale.address)).to.eq(oldCashBalanceOfWhale.add(SEIGNIORAGE_AMOUNT));
          });

          it('Should earn 50% after 4 hrs if I own 100% of the pool', async () => {
            const oldCashBalanceOfWhale = await cash.balanceOf(whale.address);
            await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT)

            await advanceTimeAndBlock(
              provider,
              4 * 60 * 60
            );

            await expect(boardroom.connect(whale).claimReward())
              .to.emit(boardroom, 'RewardPaid')
              .withArgs(whale.address, SEIGNIORAGE_AMOUNT.div(2))

            expect(await share.balanceOf(whale.address)).to.eq(ZERO);
            expect(await vault.balanceOf(whale.address)).to.eq(STAKE_AMOUNT);
            expect(await cash.balanceOf(whale.address)).to.eq(oldCashBalanceOfWhale.add(SEIGNIORAGE_AMOUNT.div(2)));
          });

          it('Should earn 50% after 8 hrs if I own 50% of the pool', async () => {
            const oldCashBalanceOfWhale = await cash.balanceOf(whale.address);
            await vault.connect(abuser).bond(STAKE_AMOUNT);
            await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT)

            await advanceTimeAndBlock(
              provider,
              8 * 60 * 60
            );

            await expect(boardroom.connect(whale).claimReward())
              .to.emit(boardroom, 'RewardPaid')
              .withArgs(whale.address, SEIGNIORAGE_AMOUNT.div(2))

            expect(await share.balanceOf(whale.address)).to.eq(ZERO);
            expect(await vault.balanceOf(whale.address)).to.eq(STAKE_AMOUNT);
            expect(await cash.balanceOf(whale.address)).to.eq(oldCashBalanceOfWhale.add(SEIGNIORAGE_AMOUNT.div(2)));
          });

          it('Should earn 25% after 4 hrs if I own 50% of the pool', async () => {
            const oldCashBalanceOfWhale = await cash.balanceOf(whale.address);
            await vault.connect(abuser).bond(STAKE_AMOUNT);
            await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT)

            await advanceTimeAndBlock(
              provider,
              4 * 60 * 60
            );

            await expect(boardroom.connect(whale).claimReward())
              .to.emit(boardroom, 'RewardPaid')
              .withArgs(whale.address, SEIGNIORAGE_AMOUNT.div(4))

            expect(await share.balanceOf(whale.address)).to.eq(ZERO);
            expect(await vault.balanceOf(whale.address)).to.eq(STAKE_AMOUNT);
            expect(await cash.balanceOf(whale.address)).to.eq(oldCashBalanceOfWhale.add(SEIGNIORAGE_AMOUNT.div(4)));
          });
        });

        describe("claimReward called twice in the same epoch and I own 100% of the pool", async () => {
          it('Should earn 100% after 8 hrs and 0% after 1 hrs', async () => {
            const oldCashBalanceOfWhale = await cash.balanceOf(whale.address);
            await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT)

            await advanceTimeAndBlock(
              provider,
              8 * 60 * 60
            );

            await expect(boardroom.connect(whale).claimReward())
              .to.emit(boardroom, 'RewardPaid')
              .withArgs(whale.address, SEIGNIORAGE_AMOUNT)

            expect(await share.balanceOf(whale.address)).to.eq(ZERO);
            expect(await vault.balanceOf(whale.address)).to.eq(STAKE_AMOUNT);
            expect(await cash.balanceOf(whale.address)).to.eq(oldCashBalanceOfWhale.add(SEIGNIORAGE_AMOUNT));

            const newCashBalance = await cash.balanceOf(whale.address);

            await advanceTimeAndBlock(
              provider,
              1 * 60 * 60
            );

            await expect(boardroom.connect(whale).claimReward())
              .to.not.emit(boardroom, 'RewardPaid')

            expect(await share.balanceOf(whale.address)).to.eq(ZERO);
            expect(await vault.balanceOf(whale.address)).to.eq(STAKE_AMOUNT);
            expect(await cash.balanceOf(whale.address)).to.eq(newCashBalance);
            expect(await cash.balanceOf(whale.address)).to.eq(oldCashBalanceOfWhale.add(SEIGNIORAGE_AMOUNT));
          });

          it('Should earn 50% after 4 hrs and then 25% after 2 hrs', async () => {
            const oldCashBalanceOfWhale = await cash.balanceOf(whale.address);
            await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT)

            await advanceTimeAndBlock(
              provider,
              4 * 60 * 60
            );

            await expect(boardroom.connect(whale).claimReward())
              .to.emit(boardroom, 'RewardPaid')
              .withArgs(whale.address, SEIGNIORAGE_AMOUNT.div(2))

            expect(await share.balanceOf(whale.address)).to.eq(ZERO);
            expect(await vault.balanceOf(whale.address)).to.eq(STAKE_AMOUNT);
            expect(await cash.balanceOf(whale.address)).to.eq(oldCashBalanceOfWhale.add(SEIGNIORAGE_AMOUNT.div(2)));

            const newCashBalance = await cash.balanceOf(whale.address);

            await advanceTimeAndBlock(
              provider,
              2 * 60 * 60
            );

            await expect(boardroom.connect(whale).claimReward())
              .to.emit(boardroom, 'RewardPaid')
              .withArgs(whale.address, SEIGNIORAGE_AMOUNT.div(4))

            expect(await share.balanceOf(whale.address)).to.eq(ZERO);
            expect(await vault.balanceOf(whale.address)).to.eq(STAKE_AMOUNT);
            expect(await cash.balanceOf(whale.address)).to.eq(newCashBalance.add(SEIGNIORAGE_AMOUNT.div(4)));
            expect(await cash.balanceOf(whale.address)).to.eq(oldCashBalanceOfWhale.add(SEIGNIORAGE_AMOUNT.div(2)).add(SEIGNIORAGE_AMOUNT.div(4)));
          });

          it('Should earn 25% after 2hr, 25% after 2 hrs and then 25% after 2 hrs', async () => {
            const oldCashBalanceOfWhale = await cash.balanceOf(whale.address);
            await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT)

            await advanceTimeAndBlock(
              provider,
              2 * 60 * 60
            );

            await expect(boardroom.connect(whale).claimReward())
              .to.emit(boardroom, 'RewardPaid')
              .withArgs(whale.address, SEIGNIORAGE_AMOUNT.div(4))

            expect(await share.balanceOf(whale.address)).to.eq(ZERO);
            expect(await vault.balanceOf(whale.address)).to.eq(STAKE_AMOUNT);
            expect(await cash.balanceOf(whale.address)).to.eq(oldCashBalanceOfWhale.add(SEIGNIORAGE_AMOUNT.div(4)));

            let newCashBalance = await cash.balanceOf(whale.address);

            await advanceTimeAndBlock(
              provider,
              2 * 60 * 60
            );

            await expect(boardroom.connect(whale).claimReward())
              .to.emit(boardroom, 'RewardPaid')
              .withArgs(whale.address, SEIGNIORAGE_AMOUNT.div(4))

            expect(await share.balanceOf(whale.address)).to.eq(ZERO);
            expect(await vault.balanceOf(whale.address)).to.eq(STAKE_AMOUNT);
            expect(await cash.balanceOf(whale.address)).to.eq(newCashBalance.add(SEIGNIORAGE_AMOUNT.div(4)));

            newCashBalance = await cash.balanceOf(whale.address);

            await advanceTimeAndBlock(
              provider,
              2 * 60 * 60
            );

            await expect(boardroom.connect(whale).claimReward())
              .to.emit(boardroom, 'RewardPaid')
              .withArgs(whale.address, SEIGNIORAGE_AMOUNT.div(4))

            expect(await share.balanceOf(whale.address)).to.eq(ZERO);
            expect(await vault.balanceOf(whale.address)).to.eq(STAKE_AMOUNT);
            expect(await cash.balanceOf(whale.address)).to.eq(newCashBalance.add(SEIGNIORAGE_AMOUNT.div(4)));
            expect(await cash.balanceOf(whale.address)).to.eq(oldCashBalanceOfWhale.add(SEIGNIORAGE_AMOUNT.div(4).mul(3)));
          });

          it('Should earn 25% after 2hr, 25% after 2 hrs and then 25% after 2 hrs and 25 % after 2 hrs again', async () => {
            const oldCashBalanceOfWhale = await cash.balanceOf(whale.address);
            await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT)

            await advanceTimeAndBlock(
              provider,
              2 * 60 * 60
            );

            await expect(boardroom.connect(whale).claimReward())
              .to.emit(boardroom, 'RewardPaid')
              .withArgs(whale.address, SEIGNIORAGE_AMOUNT.div(4))

            expect(await share.balanceOf(whale.address)).to.eq(ZERO);
            expect(await vault.balanceOf(whale.address)).to.eq(STAKE_AMOUNT);
            expect(await cash.balanceOf(whale.address)).to.eq(oldCashBalanceOfWhale.add(SEIGNIORAGE_AMOUNT.div(4)));

            let newCashBalance = await cash.balanceOf(whale.address);

            await advanceTimeAndBlock(
              provider,
              2 * 60 * 60
            );

            await expect(boardroom.connect(whale).claimReward())
              .to.emit(boardroom, 'RewardPaid')
              .withArgs(whale.address, SEIGNIORAGE_AMOUNT.div(4))

            expect(await share.balanceOf(whale.address)).to.eq(ZERO);
            expect(await vault.balanceOf(whale.address)).to.eq(STAKE_AMOUNT);
            expect(await cash.balanceOf(whale.address)).to.eq(newCashBalance.add(SEIGNIORAGE_AMOUNT.div(4)));

            newCashBalance = await cash.balanceOf(whale.address);

            await advanceTimeAndBlock(
              provider,
              2 * 60 * 60
            );

            await expect(boardroom.connect(whale).claimReward())
              .to.emit(boardroom, 'RewardPaid')
              .withArgs(whale.address, SEIGNIORAGE_AMOUNT.div(4))

            expect(await share.balanceOf(whale.address)).to.eq(ZERO);
            expect(await vault.balanceOf(whale.address)).to.eq(STAKE_AMOUNT);
            expect(await cash.balanceOf(whale.address)).to.eq(newCashBalance.add(SEIGNIORAGE_AMOUNT.div(4)));

            newCashBalance = await cash.balanceOf(whale.address);

            await advanceTimeAndBlock(
              provider,
              2 * 60 * 60
            );

            await expect(boardroom.connect(whale).claimReward())
              .to.emit(boardroom, 'RewardPaid')
              .withArgs(whale.address, SEIGNIORAGE_AMOUNT.div(4))

            expect(await share.balanceOf(whale.address)).to.eq(ZERO);
            expect(await vault.balanceOf(whale.address)).to.eq(STAKE_AMOUNT);
            expect(await cash.balanceOf(whale.address)).to.eq(newCashBalance.add(SEIGNIORAGE_AMOUNT.div(4)));
            expect(await cash.balanceOf(whale.address)).to.eq(oldCashBalanceOfWhale.add(SEIGNIORAGE_AMOUNT));
          });

          it('Should earn 25% after 2 hrs and then 75% after 6 hrs', async () => {
            const oldCashBalanceOfWhale = await cash.balanceOf(whale.address);
            await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT)

            await advanceTimeAndBlock(
              provider,
              2 * 60 * 60
            );

            await expect(boardroom.connect(whale).claimReward())
              .to.emit(boardroom, 'RewardPaid')
              .withArgs(whale.address, SEIGNIORAGE_AMOUNT.div(4))

            expect(await share.balanceOf(whale.address)).to.eq(ZERO);
            expect(await vault.balanceOf(whale.address)).to.eq(STAKE_AMOUNT);
            expect(await cash.balanceOf(whale.address)).to.eq(oldCashBalanceOfWhale.add(SEIGNIORAGE_AMOUNT.div(4)));

            const newCashBalance = await cash.balanceOf(whale.address);

            await advanceTimeAndBlock(
              provider,
              6 * 60 * 60
            );

            await expect(boardroom.connect(whale).claimReward())
              .to.emit(boardroom, 'RewardPaid')
              .withArgs(whale.address, SEIGNIORAGE_AMOUNT.sub(SEIGNIORAGE_AMOUNT.div(4)))

            expect(await share.balanceOf(whale.address)).to.eq(ZERO);
            expect(await vault.balanceOf(whale.address)).to.eq(STAKE_AMOUNT);
            expect(await cash.balanceOf(whale.address)).to.eq(newCashBalance.add(SEIGNIORAGE_AMOUNT.sub(SEIGNIORAGE_AMOUNT.div(4))));
          });
        })
      })

      describe("allocateSeigniorage() allocates 100% of the supply twice across 12 + 12 hrs", async () => {
        beforeEach('allocateSeigniorage()', async () => {
          await cash.connect(operator).mint(operator.address, SEIGNIORAGE_AMOUNT.mul(4));
          await cash.connect(operator).approve(boardroom.address, SEIGNIORAGE_AMOUNT.mul(4));
        });

        describe("claimReward called once", async () => {
          it('Should earn 300% after 3poch + 8 hrs if i\'m the only person bonding in the pool', async () => {
            const oldCashBalanceOfWhale = await cash.balanceOf(whale.address);
            await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT)

            await advanceTimeAndBlock(
              provider,
              12 * 60 * 60
            );

            await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT)

            await advanceTimeAndBlock(
              provider,
              12 * 60 * 60
            );

            await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT)

            await advanceTimeAndBlock(
              provider,
              8 * 60 * 60
            );

            await expect(boardroom.connect(whale).claimReward())
              .to.emit(boardroom, 'RewardPaid')
              .withArgs(whale.address, SEIGNIORAGE_AMOUNT.mul(3))

            expect(await share.balanceOf(whale.address)).to.eq(ZERO);
            expect(await vault.balanceOf(whale.address)).to.eq(STAKE_AMOUNT);
            expect(await cash.balanceOf(whale.address)).to.eq(oldCashBalanceOfWhale.add(SEIGNIORAGE_AMOUNT.mul(3)));
          });

          it('Should earn 400% after 4epoch + 8 hrs if i\'m the only person bonding in the pool', async () => {
            const oldCashBalanceOfWhale = await cash.balanceOf(whale.address);
            await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT)

            await advanceTimeAndBlock(
              provider,
              12 * 60 * 60
            );

            await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT)

            await advanceTimeAndBlock(
              provider,
              12 * 60 * 60
            );

            await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT)

            await advanceTimeAndBlock(
              provider,
              12 * 60 * 60
            );

            await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT)

            await advanceTimeAndBlock(
              provider,
              8 * 60 * 60
            );

            await expect(boardroom.connect(whale).claimReward())
              .to.emit(boardroom, 'RewardPaid')
              .withArgs(whale.address, SEIGNIORAGE_AMOUNT.mul(4))

            expect(await share.balanceOf(whale.address)).to.eq(ZERO);
            expect(await vault.balanceOf(whale.address)).to.eq(STAKE_AMOUNT);
            expect(await cash.balanceOf(whale.address)).to.eq(oldCashBalanceOfWhale.add(SEIGNIORAGE_AMOUNT.mul(4)));
          });

          it('Should earn 200% after 12 + 8 hrs if i\'m the only person bonding in the pool', async () => {
            const oldCashBalanceOfWhale = await cash.balanceOf(whale.address);
            await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT)

            await advanceTimeAndBlock(
              provider,
              12 * 60 * 60
            );

            await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT)

            await advanceTimeAndBlock(
              provider,
              8 * 60 * 60
            );

            await expect(boardroom.connect(whale).claimReward())
              .to.emit(boardroom, 'RewardPaid')
              .withArgs(whale.address, SEIGNIORAGE_AMOUNT.mul(2))

            expect(await share.balanceOf(whale.address)).to.eq(ZERO);
            expect(await vault.balanceOf(whale.address)).to.eq(STAKE_AMOUNT);
            expect(await cash.balanceOf(whale.address)).to.eq(oldCashBalanceOfWhale.add(SEIGNIORAGE_AMOUNT.mul(2)));
          });

          it('Should earn 150% after 12 + 4 hrs if I own 100% of the pool', async () => {
            const oldCashBalanceOfWhale = await cash.balanceOf(whale.address);
            await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT)

            await advanceTimeAndBlock(
              provider,
              12 * 60 * 60
            );

            await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT)

            await advanceTimeAndBlock(
              provider,
              4 * 60 * 60
            );

            await expect(boardroom.connect(whale).claimReward())
              .to.emit(boardroom, 'RewardPaid')
              .withArgs(whale.address, SEIGNIORAGE_AMOUNT.add(SEIGNIORAGE_AMOUNT.div(2)))

            expect(await share.balanceOf(whale.address)).to.eq(ZERO);
            expect(await vault.balanceOf(whale.address)).to.eq(STAKE_AMOUNT);
            expect(await cash.balanceOf(whale.address))
              .to.eq(
                oldCashBalanceOfWhale
                  .add(SEIGNIORAGE_AMOUNT)
                  .add(SEIGNIORAGE_AMOUNT.div(2))
              );
          });

          it('Should earn 250% after 3epochs, 4hrs in and if I own 100% of the pool', async () => {
            const oldCashBalanceOfWhale = await cash.balanceOf(whale.address);
            await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT)

            await advanceTimeAndBlock(
              provider,
              12 * 60 * 60
            );

            await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT)

            await advanceTimeAndBlock(
              provider,
              12 * 60 * 60
            );

            await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT)

            await advanceTimeAndBlock(
              provider,
              4 * 60 * 60
            );

            await expect(boardroom.connect(whale).claimReward())
              .to.emit(boardroom, 'RewardPaid')
              .withArgs(whale.address, SEIGNIORAGE_AMOUNT
                .add(SEIGNIORAGE_AMOUNT)
                .add(SEIGNIORAGE_AMOUNT.div(2)))

            expect(await share.balanceOf(whale.address)).to.eq(ZERO);
            expect(await vault.balanceOf(whale.address)).to.eq(STAKE_AMOUNT);
            expect(await cash.balanceOf(whale.address))
              .to.eq(
                oldCashBalanceOfWhale
                  .add(SEIGNIORAGE_AMOUNT)
                  .add(SEIGNIORAGE_AMOUNT)
                  .add(SEIGNIORAGE_AMOUNT.div(2))
              );
          });

          it('Should earn 350% after 4epochs, 4hrs in and if I own 100% of the pool', async () => {
            const oldCashBalanceOfWhale = await cash.balanceOf(whale.address);
            await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT)

            await advanceTimeAndBlock(
              provider,
              12 * 60 * 60
            );

            await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT)

            await advanceTimeAndBlock(
              provider,
              12 * 60 * 60
            );

            await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT)

            await advanceTimeAndBlock(
              provider,
              12 * 60 * 60
            );

            await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT)

            await advanceTimeAndBlock(
              provider,
              4 * 60 * 60
            );

            await expect(boardroom.connect(whale).claimReward())
              .to.emit(boardroom, 'RewardPaid')
              .withArgs(whale.address, SEIGNIORAGE_AMOUNT
                .add(SEIGNIORAGE_AMOUNT)
                .add(SEIGNIORAGE_AMOUNT)
                .add(SEIGNIORAGE_AMOUNT.div(2)))

            expect(await share.balanceOf(whale.address)).to.eq(ZERO);
            expect(await vault.balanceOf(whale.address)).to.eq(STAKE_AMOUNT);
            expect(await cash.balanceOf(whale.address))
              .to.eq(
                oldCashBalanceOfWhale
                  .add(SEIGNIORAGE_AMOUNT)
                  .add(SEIGNIORAGE_AMOUNT)
                  .add(SEIGNIORAGE_AMOUNT)
                  .add(SEIGNIORAGE_AMOUNT.div(2))
              );
          });

          it('Should earn 100%  percent after 8 hrs(epoch1), 150% after 3 epoch 4 hours if I own 100% of the pool', async () => {
            const oldCashBalanceOfWhale = await cash.balanceOf(whale.address);
            await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT)

            await advanceTimeAndBlock(
              provider,
              8 * 60 * 60
            );

            await expect(boardroom.connect(whale).claimReward())
              .to.emit(boardroom, 'RewardPaid')
              .withArgs(whale.address, SEIGNIORAGE_AMOUNT)

            expect(await share.balanceOf(whale.address)).to.eq(ZERO);
            expect(await vault.balanceOf(whale.address)).to.eq(STAKE_AMOUNT);
            expect(await cash.balanceOf(whale.address))
              .to.eq(
                oldCashBalanceOfWhale
                  .add(SEIGNIORAGE_AMOUNT)
              );

            await advanceTimeAndBlock(
              provider,
              4 * 60 * 60
            );

            await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT)

            await advanceTimeAndBlock(
              provider,
              12 * 60 * 60
            );

            await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT)

            await advanceTimeAndBlock(
              provider,
              4 * 60 * 60
            );

            await expect(boardroom.connect(whale).claimReward())
              .to.emit(boardroom, 'RewardPaid')
              .withArgs(whale.address, SEIGNIORAGE_AMOUNT.add(SEIGNIORAGE_AMOUNT.div(2)))

            expect(await share.balanceOf(whale.address)).to.eq(ZERO);
            expect(await vault.balanceOf(whale.address)).to.eq(STAKE_AMOUNT);
            expect(await cash.balanceOf(whale.address))
              .to.eq(
                oldCashBalanceOfWhale
                  .add(SEIGNIORAGE_AMOUNT)
                  .add(SEIGNIORAGE_AMOUNT)
                  .add(SEIGNIORAGE_AMOUNT.div(2))
              );
          });

          it('Should earn 100%  percent after 8 hrs(epoch1), 250% after 4 epoch 4 hrs if I own 100% of the pool', async () => {
            const oldCashBalanceOfWhale = await cash.balanceOf(whale.address);
            await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT)

            await advanceTimeAndBlock(
              provider,
              8 * 60 * 60
            );

            await expect(boardroom.connect(whale).claimReward())
              .to.emit(boardroom, 'RewardPaid')
              .withArgs(whale.address, SEIGNIORAGE_AMOUNT)

            expect(await share.balanceOf(whale.address)).to.eq(ZERO);
            expect(await vault.balanceOf(whale.address)).to.eq(STAKE_AMOUNT);
            expect(await cash.balanceOf(whale.address))
              .to.eq(
                oldCashBalanceOfWhale
                  .add(SEIGNIORAGE_AMOUNT)
              );

            await advanceTimeAndBlock(
              provider,
              4 * 60 * 60
            );

            await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT)

            await advanceTimeAndBlock(
              provider,
              12 * 60 * 60
            )

            await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT)

            await advanceTimeAndBlock(
              provider,
              12 * 60 * 60
            );

            await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT)

            await advanceTimeAndBlock(
              provider,
              4 * 60 * 60
            );

            await expect(boardroom.connect(whale).claimReward())
              .to.emit(boardroom, 'RewardPaid')
              .withArgs(whale.address, SEIGNIORAGE_AMOUNT.mul(2).add(SEIGNIORAGE_AMOUNT.div(2)))

            expect(await share.balanceOf(whale.address)).to.eq(ZERO);
            expect(await vault.balanceOf(whale.address)).to.eq(STAKE_AMOUNT);
            expect(await cash.balanceOf(whale.address))
              .to.eq(
                oldCashBalanceOfWhale
                  .add(SEIGNIORAGE_AMOUNT)
                  .add(SEIGNIORAGE_AMOUNT)
                  .add(SEIGNIORAGE_AMOUNT)
                  .add(SEIGNIORAGE_AMOUNT.div(2))
              );
          });

          it('Should earn 175% after 12 + 6 hrs if I own 100% of the pool', async () => {
            const oldCashBalanceOfWhale = await cash.balanceOf(whale.address);
            await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT)

            await advanceTimeAndBlock(
              provider,
              12 * 60 * 60
            );

            await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT)

            await advanceTimeAndBlock(
              provider,
              6 * 60 * 60
            );

            await expect(boardroom.connect(whale).claimReward())
              .to.emit(boardroom, 'RewardPaid')
              .withArgs(whale.address, SEIGNIORAGE_AMOUNT.add(SEIGNIORAGE_AMOUNT.sub(SEIGNIORAGE_AMOUNT.div(4))))

            expect(await share.balanceOf(whale.address)).to.eq(ZERO);
            expect(await vault.balanceOf(whale.address)).to.eq(STAKE_AMOUNT);
            expect(await cash.balanceOf(whale.address))
              .to.eq(
                oldCashBalanceOfWhale
                  .add(SEIGNIORAGE_AMOUNT)
                  .add(
                    SEIGNIORAGE_AMOUNT.sub(SEIGNIORAGE_AMOUNT.div(4))
                  )
              );
          });

          it('Should earn 275% after 3epochs 6 hrs in if I own 100% of the pool', async () => {
            const oldCashBalanceOfWhale = await cash.balanceOf(whale.address);
            await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT)

            await advanceTimeAndBlock(
              provider,
              12 * 60 * 60
            );

            await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT)

            await advanceTimeAndBlock(
              provider,
              12 * 60 * 60
            );

            await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT)

            await advanceTimeAndBlock(
              provider,
              6 * 60 * 60
            );

            await expect(boardroom.connect(whale).claimReward())
              .to.emit(boardroom, 'RewardPaid')
              .withArgs(whale.address, SEIGNIORAGE_AMOUNT
                .add(SEIGNIORAGE_AMOUNT)
                .add(
                  SEIGNIORAGE_AMOUNT.sub(SEIGNIORAGE_AMOUNT.div(4))
                ))

            expect(await share.balanceOf(whale.address)).to.eq(ZERO);
            expect(await vault.balanceOf(whale.address)).to.eq(STAKE_AMOUNT);
            expect(await cash.balanceOf(whale.address))
              .to.eq(
                oldCashBalanceOfWhale
                  .add(SEIGNIORAGE_AMOUNT)
                  .add(SEIGNIORAGE_AMOUNT)
                  .add(
                    SEIGNIORAGE_AMOUNT.sub(SEIGNIORAGE_AMOUNT.div(4))
                  )
              );
          });

          it('Should earn 375% after 4epochs 6 hrs in if I own 100% of the pool', async () => {
            const oldCashBalanceOfWhale = await cash.balanceOf(whale.address);
            await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT)

            await advanceTimeAndBlock(
              provider,
              12 * 60 * 60
            );

            await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT)

            await advanceTimeAndBlock(
              provider,
              12 * 60 * 60
            );

            await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT)

            await advanceTimeAndBlock(
              provider,
              12 * 60 * 60
            );

            await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT)

            await advanceTimeAndBlock(
              provider,
              6 * 60 * 60
            );

            await expect(boardroom.connect(whale).claimReward())
              .to.emit(boardroom, 'RewardPaid')
              .withArgs(whale.address, SEIGNIORAGE_AMOUNT
                .add(SEIGNIORAGE_AMOUNT)
                .add(SEIGNIORAGE_AMOUNT)
                .add(
                  SEIGNIORAGE_AMOUNT.sub(SEIGNIORAGE_AMOUNT.div(4))
                ))

            expect(await share.balanceOf(whale.address)).to.eq(ZERO);
            expect(await vault.balanceOf(whale.address)).to.eq(STAKE_AMOUNT);
            expect(await cash.balanceOf(whale.address))
              .to.eq(
                oldCashBalanceOfWhale
                  .add(SEIGNIORAGE_AMOUNT)
                  .add(SEIGNIORAGE_AMOUNT)
                  .add(SEIGNIORAGE_AMOUNT)
                  .add(
                    SEIGNIORAGE_AMOUNT.sub(SEIGNIORAGE_AMOUNT.div(4))
                  )
              );
          });

          it('Should earn 100%  percent after 8 hrs(epoch1), 175% after 3 epoch 6 hours if I own 100% of the pool', async () => {
            const oldCashBalanceOfWhale = await cash.balanceOf(whale.address);
            await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT)

            await advanceTimeAndBlock(
              provider,
              8 * 60 * 60
            );

            await expect(boardroom.connect(whale).claimReward())
              .to.emit(boardroom, 'RewardPaid')
              .withArgs(whale.address, SEIGNIORAGE_AMOUNT)

            expect(await share.balanceOf(whale.address)).to.eq(ZERO);
            expect(await vault.balanceOf(whale.address)).to.eq(STAKE_AMOUNT);
            expect(await cash.balanceOf(whale.address))
              .to.eq(
                oldCashBalanceOfWhale
                  .add(SEIGNIORAGE_AMOUNT)
              );

            await advanceTimeAndBlock(
              provider,
              4 * 60 * 60
            );

            await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT)

            await advanceTimeAndBlock(
              provider,
              12 * 60 * 60
            );

            await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT)

            await advanceTimeAndBlock(
              provider,
              6 * 60 * 60
            );

            await expect(boardroom.connect(whale).claimReward())
              .to.emit(boardroom, 'RewardPaid')
              .withArgs(whale.address, SEIGNIORAGE_AMOUNT.add(SEIGNIORAGE_AMOUNT.sub(SEIGNIORAGE_AMOUNT.div(4))))

            expect(await share.balanceOf(whale.address)).to.eq(ZERO);
            expect(await vault.balanceOf(whale.address)).to.eq(STAKE_AMOUNT);
            expect(await cash.balanceOf(whale.address))
              .to.eq(
                oldCashBalanceOfWhale
                  .add(SEIGNIORAGE_AMOUNT)
                  .add(SEIGNIORAGE_AMOUNT)
                  .add(SEIGNIORAGE_AMOUNT.sub(SEIGNIORAGE_AMOUNT.div(4)))
              );
          });

          it('Should earn 100%  percent after 8 hrs(epoch1), 275% after 4 epoch 6 hrs if I own 100% of the pool', async () => {
            const oldCashBalanceOfWhale = await cash.balanceOf(whale.address);
            await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT)

            await advanceTimeAndBlock(
              provider,
              8 * 60 * 60
            );

            await expect(boardroom.connect(whale).claimReward())
              .to.emit(boardroom, 'RewardPaid')
              .withArgs(whale.address, SEIGNIORAGE_AMOUNT)

            expect(await share.balanceOf(whale.address)).to.eq(ZERO);
            expect(await vault.balanceOf(whale.address)).to.eq(STAKE_AMOUNT);
            expect(await cash.balanceOf(whale.address))
              .to.eq(
                oldCashBalanceOfWhale
                  .add(SEIGNIORAGE_AMOUNT)
              );

            await advanceTimeAndBlock(
              provider,
              4 * 60 * 60
            );

            await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT)

            await advanceTimeAndBlock(
              provider,
              12 * 60 * 60
            )

            await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT)

            await advanceTimeAndBlock(
              provider,
              12 * 60 * 60
            );

            await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT)

            await advanceTimeAndBlock(
              provider,
              6 * 60 * 60
            );

            await expect(boardroom.connect(whale).claimReward())
              .to.emit(boardroom, 'RewardPaid')
              .withArgs(whale.address, SEIGNIORAGE_AMOUNT.mul(2).add(SEIGNIORAGE_AMOUNT.sub(SEIGNIORAGE_AMOUNT.div(4))))

            expect(await share.balanceOf(whale.address)).to.eq(ZERO);
            expect(await vault.balanceOf(whale.address)).to.eq(STAKE_AMOUNT);
            expect(await cash.balanceOf(whale.address))
              .to.eq(
                oldCashBalanceOfWhale
                  .add(SEIGNIORAGE_AMOUNT)
                  .add(SEIGNIORAGE_AMOUNT)
                  .add(SEIGNIORAGE_AMOUNT)
                  .add(SEIGNIORAGE_AMOUNT.sub(SEIGNIORAGE_AMOUNT.div(4)))
              );
          });

          it('Should earn 100% after 12 + 8 hrs if I own 50% of the pool', async () => {
            const oldCashBalanceOfWhale = await cash.balanceOf(whale.address);
            await vault.connect(abuser).bond(STAKE_AMOUNT)
            await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT)

            await advanceTimeAndBlock(
              provider,
              12 * 60 * 60
            );

            await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT)

            await advanceTimeAndBlock(
              provider,
              8 * 60 * 60
            );

            await expect(boardroom.connect(whale).claimReward())
              .to.emit(boardroom, 'RewardPaid')
              .withArgs(whale.address, SEIGNIORAGE_AMOUNT)

            expect(await share.balanceOf(whale.address)).to.eq(ZERO);
            expect(await vault.balanceOf(whale.address)).to.eq(STAKE_AMOUNT);
            expect(await cash.balanceOf(whale.address)).to.eq(oldCashBalanceOfWhale.add(SEIGNIORAGE_AMOUNT));
          });

          it('Should earn 150% after 3 epochs if I own 50% of the pool', async () => {
            const oldCashBalanceOfWhale = await cash.balanceOf(whale.address);
            await vault.connect(abuser).bond(STAKE_AMOUNT)
            await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT)

            await advanceTimeAndBlock(
              provider,
              12 * 60 * 60
            );

            await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT)

            await advanceTimeAndBlock(
              provider,
              12 * 60 * 60
            );

            await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT)

            await advanceTimeAndBlock(
              provider,
              8 * 60 * 60
            );

            await expect(boardroom.connect(whale).claimReward())
              .to.emit(boardroom, 'RewardPaid')
              .withArgs(whale.address, SEIGNIORAGE_AMOUNT.add(SEIGNIORAGE_AMOUNT.div(2)))

            expect(await share.balanceOf(whale.address)).to.eq(ZERO);
            expect(await vault.balanceOf(whale.address)).to.eq(STAKE_AMOUNT);
            expect(await cash.balanceOf(whale.address)).to.eq(oldCashBalanceOfWhale.add(SEIGNIORAGE_AMOUNT).add(SEIGNIORAGE_AMOUNT.div(2)));
          });

          it('Should earn 200% after 4 epochs if I own 50% of the pool', async () => {
            const oldCashBalanceOfWhale = await cash.balanceOf(whale.address);
            await vault.connect(abuser).bond(STAKE_AMOUNT)
            await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT)

            await advanceTimeAndBlock(
              provider,
              12 * 60 * 60
            );

            await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT)

            await advanceTimeAndBlock(
              provider,
              12 * 60 * 60
            );

            await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT)

            await advanceTimeAndBlock(
              provider,
              12 * 60 * 60
            );

            await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT)

            await advanceTimeAndBlock(
              provider,
              8 * 60 * 60
            );

            await expect(boardroom.connect(whale).claimReward())
              .to.emit(boardroom, 'RewardPaid')
              .withArgs(whale.address, SEIGNIORAGE_AMOUNT.mul(2))

            expect(await share.balanceOf(whale.address)).to.eq(ZERO);
            expect(await vault.balanceOf(whale.address)).to.eq(STAKE_AMOUNT);
            expect(await cash.balanceOf(whale.address)).to.eq(oldCashBalanceOfWhale.add(SEIGNIORAGE_AMOUNT.mul(2)));
          });

          it('Should earn 50% after 12 hrs if I own 50% of the pool', async () => {
            const oldCashBalanceOfWhale = await cash.balanceOf(whale.address);

            await vault.connect(abuser).bond(STAKE_AMOUNT)
            await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT)

            await advanceTimeAndBlock(
              provider,
              12 * 60 * 61
            );

            await expect(boardroom.connect(whale).claimReward())
              .to.emit(boardroom, 'RewardPaid')
              .withArgs(whale.address, SEIGNIORAGE_AMOUNT.div(2))

            expect(await share.balanceOf(whale.address)).to.eq(ZERO);
            expect(await vault.balanceOf(whale.address)).to.eq(STAKE_AMOUNT);
            expect(await cash.balanceOf(whale.address)).to.eq(oldCashBalanceOfWhale.add(SEIGNIORAGE_AMOUNT).div(2));
          })

          it('Should earn 100% after 24 hrs if I own 50% of the pool', async () => {
            const oldCashBalanceOfWhale = await cash.balanceOf(whale.address);
            await vault.connect(abuser).bond(STAKE_AMOUNT)
            await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT)

            await advanceTimeAndBlock(
              provider,
              12 * 60 * 61
            );

            await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT)

            await advanceTimeAndBlock(
              provider,
              12 * 60 * 61
            );

            await expect(boardroom.connect(whale).claimReward())
              .to.emit(boardroom, 'RewardPaid')
              .withArgs(whale.address, SEIGNIORAGE_AMOUNT)

            expect(await share.balanceOf(whale.address)).to.eq(ZERO);
            expect(await vault.balanceOf(whale.address)).to.eq(STAKE_AMOUNT);
            expect(await cash.balanceOf(whale.address)).to.eq(oldCashBalanceOfWhale.add(SEIGNIORAGE_AMOUNT));
          });

          it('Should earn 150% after 3epoch if I own 50% of the pool', async () => {
            const oldCashBalanceOfWhale = await cash.balanceOf(whale.address);
            await vault.connect(abuser).bond(STAKE_AMOUNT)
            await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT)

            await advanceTimeAndBlock(
              provider,
              12 * 60 * 61
            );

            await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT)

            await advanceTimeAndBlock(
              provider,
              12 * 60 * 61
            );

            await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT);

            await advanceTimeAndBlock(
              provider,
              9 * 60 * 61
            );

            await expect(boardroom.connect(whale).claimReward())
              .to.emit(boardroom, 'RewardPaid')
              .withArgs(whale.address, SEIGNIORAGE_AMOUNT.add(SEIGNIORAGE_AMOUNT.div(2)))

            expect(await share.balanceOf(whale.address)).to.eq(ZERO);
            expect(await vault.balanceOf(whale.address)).to.eq(STAKE_AMOUNT);
            expect(await cash.balanceOf(whale.address)).to.eq(oldCashBalanceOfWhale.add(SEIGNIORAGE_AMOUNT).add(SEIGNIORAGE_AMOUNT.div(2)));
          });

          it('Should earn 200% after 3epoch if I own 50% of the pool', async () => {
            const oldCashBalanceOfWhale = await cash.balanceOf(whale.address);
            await vault.connect(abuser).bond(STAKE_AMOUNT)
            await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT)

            await advanceTimeAndBlock(
              provider,
              12 * 60 * 61
            );

            await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT)

            await advanceTimeAndBlock(
              provider,
              12 * 60 * 61
            );

            await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT);

            await advanceTimeAndBlock(
              provider,
              12 * 60 * 61
            );

            await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT);

            await advanceTimeAndBlock(
              provider,
              10 * 60 * 61
            );

            await expect(boardroom.connect(whale).claimReward())
              .to.emit(boardroom, 'RewardPaid')
              .withArgs(whale.address, SEIGNIORAGE_AMOUNT.mul(2))

            expect(await share.balanceOf(whale.address)).to.eq(ZERO);
            expect(await vault.balanceOf(whale.address)).to.eq(STAKE_AMOUNT);
            expect(await cash.balanceOf(whale.address)).to.eq(oldCashBalanceOfWhale.add(SEIGNIORAGE_AMOUNT.mul(2)));
          });

          it('Should earn 100% for the every epoch, if we claim 8 hrs after allocation(every epoch)', async () => {
            const oldCashBalanceOfWhale = await cash.balanceOf(whale.address);
            await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT)

            await advanceTimeAndBlock(
              provider,
              8 * 60 * 60
            );

            await expect(boardroom.connect(whale).claimReward())
              .to.emit(boardroom, 'RewardPaid')
              .withArgs(whale.address, SEIGNIORAGE_AMOUNT)

            expect(await share.balanceOf(whale.address)).to.eq(ZERO);
            expect(await vault.balanceOf(whale.address)).to.eq(STAKE_AMOUNT);
            expect(await cash.balanceOf(whale.address)).to.eq(oldCashBalanceOfWhale.add(SEIGNIORAGE_AMOUNT));

            await advanceTimeAndBlock(
              provider,
              4 * 60 * 60
            );

            await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT)

            await advanceTimeAndBlock(
              provider,
              8 * 60 * 60
            );

            await expect(boardroom.connect(whale).claimReward())
              .to.emit(boardroom, 'RewardPaid')
              .withArgs(whale.address, SEIGNIORAGE_AMOUNT)

            expect(await share.balanceOf(whale.address)).to.eq(ZERO);
            expect(await vault.balanceOf(whale.address)).to.eq(STAKE_AMOUNT);
            expect(await cash.balanceOf(whale.address)).to.eq(oldCashBalanceOfWhale.add(SEIGNIORAGE_AMOUNT.mul(2)));

            await advanceTimeAndBlock(
              provider,
              4 * 60 * 60
            );

            await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT)

            await advanceTimeAndBlock(
              provider,
              8 * 60 * 60
            );

            await expect(boardroom.connect(whale).claimReward())
              .to.emit(boardroom, 'RewardPaid')
              .withArgs(whale.address, SEIGNIORAGE_AMOUNT)

            expect(await share.balanceOf(whale.address)).to.eq(ZERO);
            expect(await vault.balanceOf(whale.address)).to.eq(STAKE_AMOUNT);
            expect(await cash.balanceOf(whale.address)).to.eq(oldCashBalanceOfWhale.add(SEIGNIORAGE_AMOUNT.mul(3)));

            await advanceTimeAndBlock(
              provider,
              4 * 60 * 60
            );

            await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT)

            await advanceTimeAndBlock(
              provider,
              8 * 60 * 60
            );

            await expect(boardroom.connect(whale).claimReward())
              .to.emit(boardroom, 'RewardPaid')
              .withArgs(whale.address, SEIGNIORAGE_AMOUNT)

            expect(await share.balanceOf(whale.address)).to.eq(ZERO);
            expect(await vault.balanceOf(whale.address)).to.eq(STAKE_AMOUNT);
            expect(await cash.balanceOf(whale.address)).to.eq(oldCashBalanceOfWhale.add(SEIGNIORAGE_AMOUNT.mul(4)));
          });

          it('Should earn 50% for the every epoch, if we claim 8 hrs after allocation(every epoch)', async () => {
            const oldCashBalanceOfWhale = await cash.balanceOf(whale.address);

            await vault.connect(abuser).bond(STAKE_AMOUNT);
            await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT)

            await advanceTimeAndBlock(
              provider,
              8 * 60 * 60
            );

            await expect(boardroom.connect(whale).claimReward())
              .to.emit(boardroom, 'RewardPaid')
              .withArgs(whale.address, SEIGNIORAGE_AMOUNT.div(2))

            expect(await share.balanceOf(whale.address)).to.eq(ZERO);
            expect(await vault.balanceOf(whale.address)).to.eq(STAKE_AMOUNT);
            expect(await cash.balanceOf(whale.address)).to.eq(oldCashBalanceOfWhale.add(SEIGNIORAGE_AMOUNT.div(2)));

            await advanceTimeAndBlock(
              provider,
              4 * 60 * 60
            );

            await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT)

            await advanceTimeAndBlock(
              provider,
              8 * 60 * 60
            );

            await expect(boardroom.connect(whale).claimReward())
              .to.emit(boardroom, 'RewardPaid')
              .withArgs(whale.address, SEIGNIORAGE_AMOUNT.div(2))

            expect(await share.balanceOf(whale.address)).to.eq(ZERO);
            expect(await vault.balanceOf(whale.address)).to.eq(STAKE_AMOUNT);
            expect(await cash.balanceOf(whale.address)).to.eq(oldCashBalanceOfWhale.add(SEIGNIORAGE_AMOUNT));

            await advanceTimeAndBlock(
              provider,
              4 * 60 * 60
            );

            await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT)

            await advanceTimeAndBlock(
              provider,
              8 * 60 * 60
            );

            await expect(boardroom.connect(whale).claimReward())
              .to.emit(boardroom, 'RewardPaid')
              .withArgs(whale.address, SEIGNIORAGE_AMOUNT.div(2))

            expect(await share.balanceOf(whale.address)).to.eq(ZERO);
            expect(await vault.balanceOf(whale.address)).to.eq(STAKE_AMOUNT);
            expect(await cash.balanceOf(whale.address)).to.eq(oldCashBalanceOfWhale.add(SEIGNIORAGE_AMOUNT.add(SEIGNIORAGE_AMOUNT.div(2))));

            await advanceTimeAndBlock(
              provider,
              4 * 60 * 60
            );

            await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT)

            await advanceTimeAndBlock(
              provider,
              8 * 60 * 60
            );

            await expect(boardroom.connect(whale).claimReward())
              .to.emit(boardroom, 'RewardPaid')
              .withArgs(whale.address, SEIGNIORAGE_AMOUNT.div(2))

            expect(await share.balanceOf(whale.address)).to.eq(ZERO);
            expect(await vault.balanceOf(whale.address)).to.eq(STAKE_AMOUNT);
            expect(await cash.balanceOf(whale.address)).to.eq(oldCashBalanceOfWhale.add(SEIGNIORAGE_AMOUNT.mul(2)));
          });
        })

        describe("claimReward called twice in the two different epochs and I own 100% of the pool", async () => {
          it('Should earn 100% for the first claim in 8 hrs and then 100% for the second claim in 4 + 8 hrs', async () => {
            const oldCashBalanceOfWhale = await cash.balanceOf(whale.address);
            await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT)

            await advanceTimeAndBlock(
              provider,
              8 * 60 * 60
            );

            await expect(boardroom.connect(whale).claimReward())
              .to.emit(boardroom, 'RewardPaid')
              .withArgs(whale.address, SEIGNIORAGE_AMOUNT)

            expect(await share.balanceOf(whale.address)).to.eq(ZERO);
            expect(await vault.balanceOf(whale.address)).to.eq(STAKE_AMOUNT);
            expect(await cash.balanceOf(whale.address)).to.eq(oldCashBalanceOfWhale.add(SEIGNIORAGE_AMOUNT));

            let newCashBalaceOfWhale = await cash.balanceOf(whale.address);

            await advanceTimeAndBlock(
              provider,
              4 * 60 * 60
            );

            await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT)

            await advanceTimeAndBlock(
              provider,
              8 * 60 * 60
            );

            await expect(boardroom.connect(whale).claimReward())
              .to.emit(boardroom, 'RewardPaid')
              .withArgs(whale.address, SEIGNIORAGE_AMOUNT)

            expect(await share.balanceOf(whale.address)).to.eq(ZERO);
            expect(await vault.balanceOf(whale.address)).to.eq(STAKE_AMOUNT);
            expect(await cash.balanceOf(whale.address)).to.eq(oldCashBalanceOfWhale.add(SEIGNIORAGE_AMOUNT.mul(2)));
            expect(await cash.balanceOf(whale.address)).to.eq(newCashBalaceOfWhale.add(SEIGNIORAGE_AMOUNT));
          });

          it('Should earn 50% for the first claim in 4 hrs and then 150% for the second claim in 8 + 8 hrs', async () => {
            const oldCashBalanceOfWhale = await cash.balanceOf(whale.address);
            await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT)

            await advanceTimeAndBlock(
              provider,
              4 * 60 * 60
            );

            await expect(boardroom.connect(whale).claimReward())
              .to.emit(boardroom, 'RewardPaid')
              .withArgs(whale.address, SEIGNIORAGE_AMOUNT.div(2))

            expect(await share.balanceOf(whale.address)).to.eq(ZERO);
            expect(await vault.balanceOf(whale.address)).to.eq(STAKE_AMOUNT);
            expect(await cash.balanceOf(whale.address)).to.eq(oldCashBalanceOfWhale.add(SEIGNIORAGE_AMOUNT.div(2)));

            let newCashBalaceOfWhale = await cash.balanceOf(whale.address);

            await advanceTimeAndBlock(
              provider,
              8 * 60 * 60
            );

            await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT)

            await advanceTimeAndBlock(
              provider,
              8 * 60 * 60
            );

            await expect(boardroom.connect(whale).claimReward())
              .to.emit(boardroom, 'RewardPaid')
              .withArgs(whale.address, SEIGNIORAGE_AMOUNT.add(SEIGNIORAGE_AMOUNT.div(2)))

            expect(await share.balanceOf(whale.address)).to.eq(ZERO);
            expect(await vault.balanceOf(whale.address)).to.eq(STAKE_AMOUNT);
            expect(await cash.balanceOf(whale.address))
              .to.eq(oldCashBalanceOfWhale.add(SEIGNIORAGE_AMOUNT.mul(2)));
            expect(await cash.balanceOf(whale.address))
              .to.eq(newCashBalaceOfWhale.add(SEIGNIORAGE_AMOUNT).add(SEIGNIORAGE_AMOUNT.div(2)));
          });

          it('Should earn 0% for the first claim in 0 hrs and then 200% for the second claim in 12 + 8 hrs', async () => {
            const oldCashBalanceOfWhale = await cash.balanceOf(whale.address);

            await expect(boardroom.connect(whale).claimReward())
              .to.not.emit(boardroom, 'RewardPaid')

            expect(await share.balanceOf(whale.address)).to.eq(ZERO);
            expect(await vault.balanceOf(whale.address)).to.eq(STAKE_AMOUNT);
            expect(await cash.balanceOf(whale.address)).to.eq(oldCashBalanceOfWhale);

            await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT)

            await advanceTimeAndBlock(
              provider,
              12 * 60 * 60
            );

            await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT)

            await advanceTimeAndBlock(
              provider,
              8 * 60 * 60
            );

            await expect(boardroom.connect(whale).claimReward())
              .to.emit(boardroom, 'RewardPaid')
              .withArgs(whale.address, SEIGNIORAGE_AMOUNT.mul(2))

            expect(await share.balanceOf(whale.address)).to.eq(ZERO);
            expect(await vault.balanceOf(whale.address)).to.eq(STAKE_AMOUNT);
            expect(await cash.balanceOf(whale.address)).to.eq(oldCashBalanceOfWhale.add(SEIGNIORAGE_AMOUNT.mul(2)));
          });

          it('Should earn 0% for the first claim in 0 hrs and then 100% for the second claim in 8 + 1 hrs', async () => {
            const oldCashBalanceOfWhale = await cash.balanceOf(whale.address);

            await expect(boardroom.connect(whale).claimReward())
              .to.not.emit(boardroom, 'RewardPaid')

            expect(await share.balanceOf(whale.address)).to.eq(ZERO);
            expect(await vault.balanceOf(whale.address)).to.eq(STAKE_AMOUNT);
            expect(await cash.balanceOf(whale.address)).to.eq(oldCashBalanceOfWhale);

            await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT)

            await advanceTimeAndBlock(
              provider,
              9 * 60 * 60
            );

            await expect(boardroom.connect(whale).claimReward())
              .to.emit(boardroom, 'RewardPaid')
              .withArgs(whale.address, SEIGNIORAGE_AMOUNT)

            expect(await share.balanceOf(whale.address)).to.eq(ZERO);
            expect(await vault.balanceOf(whale.address)).to.eq(STAKE_AMOUNT);
            expect(await cash.balanceOf(whale.address)).to.eq(oldCashBalanceOfWhale.add(SEIGNIORAGE_AMOUNT));
          });

          it('Should earn 100% for the first claim in 8 hrs and then 0% for the second claim in 8 + 1 hrs', async () => {
            const oldCashBalanceOfWhale = await cash.balanceOf(whale.address);
            await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT)

            await advanceTimeAndBlock(
              provider,
              8 * 60 * 60
            );

            await expect(boardroom.connect(whale).claimReward())
              .to.emit(boardroom, 'RewardPaid')
              .withArgs(whale.address, SEIGNIORAGE_AMOUNT)

            expect(await share.balanceOf(whale.address)).to.eq(ZERO);
            expect(await vault.balanceOf(whale.address)).to.eq(STAKE_AMOUNT);
            expect(await cash.balanceOf(whale.address)).to.eq(oldCashBalanceOfWhale.add(SEIGNIORAGE_AMOUNT));

            let newCashBalaceOfWhale = await cash.balanceOf(whale.address);

            await advanceTimeAndBlock(
              provider,
              1 * 60 * 60
            );

            await expect(boardroom.connect(whale).claimReward())
              .to.not.emit(boardroom, 'RewardPaid')

            expect(await share.balanceOf(whale.address)).to.eq(ZERO);
            expect(await vault.balanceOf(whale.address)).to.eq(STAKE_AMOUNT);
            expect(await cash.balanceOf(whale.address)).to.eq(oldCashBalanceOfWhale.add(SEIGNIORAGE_AMOUNT));
            expect(await cash.balanceOf(whale.address)).to.eq(newCashBalaceOfWhale);
          });

          it('Should earn 100% for the first claim in 8 hrs and then 50% for the second claim in 8 + 4 hrs', async () => {
            const oldCashBalanceOfWhale = await cash.balanceOf(whale.address);
            await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT)

            await advanceTimeAndBlock(
              provider,
              8 * 60 * 60
            );

            await expect(boardroom.connect(whale).claimReward())
              .to.emit(boardroom, 'RewardPaid')
              .withArgs(whale.address, SEIGNIORAGE_AMOUNT)

            expect(await share.balanceOf(whale.address)).to.eq(ZERO);
            expect(await vault.balanceOf(whale.address)).to.eq(STAKE_AMOUNT);
            expect(await cash.balanceOf(whale.address)).to.eq(oldCashBalanceOfWhale.add(SEIGNIORAGE_AMOUNT));

            let newCashBalaceOfWhale = await cash.balanceOf(whale.address);

            await advanceTimeAndBlock(
              provider,
              4 * 60 * 60
            );

            await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT)

            await advanceTimeAndBlock(
              provider,
              4 * 60 * 60
            );

            await expect(boardroom.connect(whale).claimReward())
              .to.emit(boardroom, 'RewardPaid')
              .withArgs(whale.address, SEIGNIORAGE_AMOUNT.div(2))

            expect(await share.balanceOf(whale.address)).to.eq(ZERO);
            expect(await vault.balanceOf(whale.address)).to.eq(STAKE_AMOUNT);
            expect(await cash.balanceOf(whale.address)).to.eq(oldCashBalanceOfWhale.add(SEIGNIORAGE_AMOUNT).add(SEIGNIORAGE_AMOUNT.div(2)));
            expect(await cash.balanceOf(whale.address)).to.eq(newCashBalaceOfWhale.add(SEIGNIORAGE_AMOUNT.div(2)));
          });
        });
      });
    })

    describe("I bond at the second epoch", async () => {
      beforeEach('allocateSeigniorage()', async () => {
        await cash.connect(operator).mint(operator.address, SEIGNIORAGE_AMOUNT.mul(4));
        await cash.connect(operator).approve(boardroom.address, SEIGNIORAGE_AMOUNT.mul(4));
      });

      it('should not earn anything from the 3 epochs if i bond after 3rd allocation', async () => {
        await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT)

        await advanceTimeAndBlock(
          provider,
          12 * 60 * 60
        );

        await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT)

        await advanceTimeAndBlock(
          provider,
          12 * 60 * 60
        );

        const oldCashBalanceOfAbuser = await cash.balanceOf(abuser.address);

        await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT)

        await vault.connect(abuser).bond(STAKE_AMOUNT);

        await advanceTimeAndBlock(
          provider,
          4 * 60 * 60
        );

        await expect(boardroom.connect(abuser).claimReward())
          .to.not.emit(boardroom, 'RewardPaid')

        expect(await share.balanceOf(abuser.address)).to.eq(ZERO);
        expect(await vault.balanceOf(abuser.address)).to.eq(STAKE_AMOUNT);

        expect(await cash.balanceOf(abuser.address)).to.eq(oldCashBalanceOfAbuser);
      });

      it('should not earn anything from the 4 epochs if i bond after 4th allocation', async () => {
        await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT)

        await advanceTimeAndBlock(
          provider,
          12 * 60 * 60
        );

        await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT)

        await advanceTimeAndBlock(
          provider,
          12 * 60 * 60
        );

        const oldCashBalanceOfAbuser = await cash.balanceOf(abuser.address);

        await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT)

        await advanceTimeAndBlock(
          provider,
          12 * 60 * 60
        );

        await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT)

        await vault.connect(abuser).bond(STAKE_AMOUNT);

        await advanceTimeAndBlock(
          provider,
          4 * 60 * 60
        );

        await expect(boardroom.connect(abuser).claimReward())
          .to.not.emit(boardroom, 'RewardPaid')

        expect(await share.balanceOf(abuser.address)).to.eq(ZERO);
        expect(await vault.balanceOf(abuser.address)).to.eq(STAKE_AMOUNT);

        expect(await cash.balanceOf(abuser.address)).to.eq(oldCashBalanceOfAbuser);
      });

      it('should not earn anything from the 2 epochs if i bond before 3rd allocation', async () => {
        await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT)

        await advanceTimeAndBlock(
          provider,
          12 * 60 * 60
        );

        await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT)

        await advanceTimeAndBlock(
          provider,
          12 * 60 * 60
        );

        const oldCashBalanceOfAbuser = await cash.balanceOf(abuser.address);

        await vault.connect(abuser).bond(STAKE_AMOUNT);

        await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT)

        await advanceTimeAndBlock(
          provider,
          4 * 60 * 60
        );

        await expect(boardroom.connect(abuser).claimReward())
          .to.emit(boardroom, 'RewardPaid')
          .withArgs(abuser.address, SEIGNIORAGE_AMOUNT.div(2).div(2))

        expect(await share.balanceOf(abuser.address)).to.eq(ZERO);
        expect(await vault.balanceOf(abuser.address)).to.eq(STAKE_AMOUNT);

        expect(await cash.balanceOf(abuser.address)).to.eq(oldCashBalanceOfAbuser.add(SEIGNIORAGE_AMOUNT.div(2).div(2)));
      });

      it('should not earn anything from the 3 epochs if i bond before 4th allocation', async () => {
        await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT)

        await advanceTimeAndBlock(
          provider,
          12 * 60 * 60
        );

        await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT)

        await advanceTimeAndBlock(
          provider,
          12 * 60 * 60
        );

        await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT)

        await advanceTimeAndBlock(
          provider,
          12 * 60 * 60
        );

        const oldCashBalanceOfAbuser = await cash.balanceOf(abuser.address);

        await vault.connect(abuser).bond(STAKE_AMOUNT);

        await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT)

        await advanceTimeAndBlock(
          provider,
          4 * 60 * 60
        );

        await expect(boardroom.connect(abuser).claimReward())
          .to.emit(boardroom, 'RewardPaid')
          .withArgs(abuser.address, SEIGNIORAGE_AMOUNT.div(2).div(2))

        expect(await share.balanceOf(abuser.address)).to.eq(ZERO);
        expect(await vault.balanceOf(abuser.address)).to.eq(STAKE_AMOUNT);

        expect(await cash.balanceOf(abuser.address)).to.eq(oldCashBalanceOfAbuser.add(SEIGNIORAGE_AMOUNT.div(2).div(2)));
      });

      it('should not earn anything from the previous epoch if i bond after 2nd allocation', async () => {
        await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT)

        await advanceTimeAndBlock(
          provider,
          12 * 60 * 60
        );

        const oldCashBalanceOfAbuser = await cash.balanceOf(abuser.address);

        await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT)

        await vault.connect(abuser).bond(STAKE_AMOUNT);

        await advanceTimeAndBlock(
          provider,
          4 * 60 * 60
        );

        await expect(boardroom.connect(abuser).claimReward())
          .to.not.emit(boardroom, 'RewardPaid')

        expect(await share.balanceOf(abuser.address)).to.eq(ZERO);
        expect(await vault.balanceOf(abuser.address)).to.eq(STAKE_AMOUNT);

        expect(await cash.balanceOf(abuser.address)).to.eq(oldCashBalanceOfAbuser);
      });

      it('should not earn anything from the previous epoch', async () => {
        await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT)

        await advanceTimeAndBlock(
          provider,
          12 * 60 * 60
        );

        const oldCashBalanceOfAbuser = await cash.balanceOf(abuser.address);

        await vault.connect(abuser).bond(STAKE_AMOUNT);
        await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT)

        await advanceTimeAndBlock(
          provider,
          4 * 60 * 60
        );

        await expect(boardroom.connect(abuser).claimReward())
          .to.emit(boardroom, 'RewardPaid')
          .withArgs(abuser.address, SEIGNIORAGE_AMOUNT.div(2).div(2))

        expect(await share.balanceOf(abuser.address)).to.eq(ZERO);
        expect(await vault.balanceOf(abuser.address)).to.eq(STAKE_AMOUNT);

        // First divide by 2 since there's whale and abuser in the staknig poool.
        // Second divide by 2 since, we should be claiming for 1epoch only.
        expect(await cash.balanceOf(abuser.address)).to.eq(oldCashBalanceOfAbuser.add(SEIGNIORAGE_AMOUNT.div(2).div(2)));
      });

      it('should earn 100% of the new rewards from the next epoch owning 100% of the pool if only staker in both epoch', async () => {
        await vault.connect(whale).unbond(STAKE_AMOUNT);
        await advanceTimeAndBlock(
          provider,
          BOARDROOM_LOCK_PERIOD
        )
        await vault.connect(whale).withdraw();

        await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT)


        await advanceTimeAndBlock(
          provider,
          (12 * 60 * 60) - (BOARDROOM_LOCK_PERIOD)
        );

        const oldCashBalanceOfAbuser = await cash.balanceOf(abuser.address);

        await vault.connect(abuser).bond(STAKE_AMOUNT);
        await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT)

        await advanceTimeAndBlock(
          provider,
          8 * 60 * 60
        );

        await expect(boardroom.connect(abuser).claimReward())
          .to.emit(boardroom, 'RewardPaid')
          .withArgs(abuser.address, SEIGNIORAGE_AMOUNT)

        expect(await share.balanceOf(abuser.address)).to.eq(ZERO);
        expect(await vault.balanceOf(abuser.address)).to.eq(STAKE_AMOUNT);
        expect(await cash.balanceOf(abuser.address)).to.eq(oldCashBalanceOfAbuser.add(SEIGNIORAGE_AMOUNT));
      });

      it('should earn 200% of the new rewards from the next epoch if claim after 3epoch owning 100% of the pool if only staker in both epoch', async () => {
        await vault.connect(whale).unbond(STAKE_AMOUNT);
        await advanceTimeAndBlock(
          provider,
          BOARDROOM_LOCK_PERIOD
        )
        await vault.connect(whale).withdraw();

        await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT)


        await advanceTimeAndBlock(
          provider,
          (12 * 60 * 60) - (BOARDROOM_LOCK_PERIOD)
        );

        const oldCashBalanceOfAbuser = await cash.balanceOf(abuser.address);

        await vault.connect(abuser).bond(STAKE_AMOUNT);
        await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT)

        await advanceTimeAndBlock(
          provider,
          (12 * 60 * 60)
        );

        await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT)

        await advanceTimeAndBlock(
          provider,
          8 * 60 * 60
        );

        await expect(boardroom.connect(abuser).claimReward())
          .to.emit(boardroom, 'RewardPaid')
          .withArgs(abuser.address, SEIGNIORAGE_AMOUNT.mul(2))

        expect(await share.balanceOf(abuser.address)).to.eq(ZERO);
        expect(await vault.balanceOf(abuser.address)).to.eq(STAKE_AMOUNT);
        expect(await cash.balanceOf(abuser.address)).to.eq(oldCashBalanceOfAbuser.add(SEIGNIORAGE_AMOUNT.mul(2)));
      });

      it('should earn 300% of the new rewards from the next epoch if claim after 4epoch owning 100% of the pool if only staker in both epoch', async () => {
        await vault.connect(whale).unbond(STAKE_AMOUNT);
        await advanceTimeAndBlock(
          provider,
          BOARDROOM_LOCK_PERIOD
        )
        await vault.connect(whale).withdraw();

        await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT)


        await advanceTimeAndBlock(
          provider,
          (12 * 60 * 60) - (BOARDROOM_LOCK_PERIOD)
        );

        const oldCashBalanceOfAbuser = await cash.balanceOf(abuser.address);

        await vault.connect(abuser).bond(STAKE_AMOUNT);
        await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT)

        await advanceTimeAndBlock(
          provider,
          (12 * 60 * 60)
        );

        await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT)

        await advanceTimeAndBlock(
          provider,
          (12 * 60 * 60)
        );

        await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT)

        await advanceTimeAndBlock(
          provider,
          8 * 60 * 60
        );

        await expect(boardroom.connect(abuser).claimReward())
          .to.emit(boardroom, 'RewardPaid')
          .withArgs(abuser.address, SEIGNIORAGE_AMOUNT.mul(3))

        expect(await share.balanceOf(abuser.address)).to.eq(ZERO);
        expect(await vault.balanceOf(abuser.address)).to.eq(STAKE_AMOUNT);
        expect(await cash.balanceOf(abuser.address)).to.eq(oldCashBalanceOfAbuser.add(SEIGNIORAGE_AMOUNT.mul(3)));
      });

      it('should earn 75% of the new rewards from the next epoch and 6hrs in owning 100% of the pool if only staker in both epoch', async () => {
        await vault.connect(whale).unbond(STAKE_AMOUNT);
        await advanceTimeAndBlock(
          provider,
          BOARDROOM_LOCK_PERIOD
        )
        await vault.connect(whale).withdraw();

        await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT)


        await advanceTimeAndBlock(
          provider,
          (12 * 60 * 60) - (BOARDROOM_LOCK_PERIOD)
        );

        const oldCashBalanceOfAbuser = await cash.balanceOf(abuser.address);

        await vault.connect(abuser).bond(STAKE_AMOUNT);
        await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT)

        await advanceTimeAndBlock(
          provider,
          6 * 60 * 60
        );

        await expect(boardroom.connect(abuser).claimReward())
          .to.emit(boardroom, 'RewardPaid')
          .withArgs(abuser.address, SEIGNIORAGE_AMOUNT.sub(SEIGNIORAGE_AMOUNT.div(4)))

        expect(await share.balanceOf(abuser.address)).to.eq(ZERO);
        expect(await vault.balanceOf(abuser.address)).to.eq(STAKE_AMOUNT);
        expect(await cash.balanceOf(abuser.address)).to.eq(oldCashBalanceOfAbuser.add(SEIGNIORAGE_AMOUNT.sub(SEIGNIORAGE_AMOUNT.div(4))));
      });

      it('should earn 175% of the new rewards from the next epoch, after 3epoch and 6hrs in owning 100% of the pool if only staker in both epoch', async () => {
        await vault.connect(whale).unbond(STAKE_AMOUNT);
        await advanceTimeAndBlock(
          provider,
          BOARDROOM_LOCK_PERIOD
        )
        await vault.connect(whale).withdraw();

        await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT)


        await advanceTimeAndBlock(
          provider,
          (12 * 60 * 60) - (BOARDROOM_LOCK_PERIOD)
        );

        const oldCashBalanceOfAbuser = await cash.balanceOf(abuser.address);

        await vault.connect(abuser).bond(STAKE_AMOUNT);
        await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT)

        await advanceTimeAndBlock(
          provider,
          (12 * 60 * 60)
        );

        await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT)

        await advanceTimeAndBlock(
          provider,
          6 * 60 * 60
        );

        await expect(boardroom.connect(abuser).claimReward())
          .to.emit(boardroom, 'RewardPaid')
          .withArgs(abuser.address, SEIGNIORAGE_AMOUNT.mul(2).sub(SEIGNIORAGE_AMOUNT.div(4)))

        expect(await share.balanceOf(abuser.address)).to.eq(ZERO);
        expect(await vault.balanceOf(abuser.address)).to.eq(STAKE_AMOUNT);
        expect(await cash.balanceOf(abuser.address)).to.eq(oldCashBalanceOfAbuser.add(SEIGNIORAGE_AMOUNT.mul(2).sub(SEIGNIORAGE_AMOUNT.div(4))));
      });

      it('should earn 275% of the new rewards from the next epoch, after 4epoch and 6hrs in owning 100% of the pool if only staker in both epoch', async () => {
        await vault.connect(whale).unbond(STAKE_AMOUNT);
        await advanceTimeAndBlock(
          provider,
          BOARDROOM_LOCK_PERIOD
        )
        await vault.connect(whale).withdraw();

        await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT)


        await advanceTimeAndBlock(
          provider,
          (12 * 60 * 60) - (BOARDROOM_LOCK_PERIOD)
        );

        const oldCashBalanceOfAbuser = await cash.balanceOf(abuser.address);

        await vault.connect(abuser).bond(STAKE_AMOUNT);
        await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT)

        await advanceTimeAndBlock(
          provider,
          (12 * 60 * 60)
        );

        await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT)

        await advanceTimeAndBlock(
          provider,
          (12 * 60 * 60)
        );

        await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT)


        await advanceTimeAndBlock(
          provider,
          6 * 60 * 60
        );

        await expect(boardroom.connect(abuser).claimReward())
          .to.emit(boardroom, 'RewardPaid')
          .withArgs(abuser.address, SEIGNIORAGE_AMOUNT.mul(3).sub(SEIGNIORAGE_AMOUNT.div(4)))

        expect(await share.balanceOf(abuser.address)).to.eq(ZERO);
        expect(await vault.balanceOf(abuser.address)).to.eq(STAKE_AMOUNT);
        expect(await cash.balanceOf(abuser.address)).to.eq(oldCashBalanceOfAbuser.add(SEIGNIORAGE_AMOUNT.mul(3).sub(SEIGNIORAGE_AMOUNT.div(4))));
      });

      it('should earn 100% of the new rewards from the next epoch owning 100% of the pool if only staker in curr epoch', async () => {
        await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT)

        await advanceTimeAndBlock(
          provider,
          (12 * 60 * 60)
        );

        await vault.connect(whale).unbond(STAKE_AMOUNT);

        await advanceTimeAndBlock(
          provider,
          BOARDROOM_LOCK_PERIOD
        )
        await vault.connect(whale).withdraw();

        const oldCashBalanceOfAbuser = await cash.balanceOf(abuser.address);

        await vault.connect(abuser).bond(STAKE_AMOUNT);
        await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT)

        await advanceTimeAndBlock(
          provider,
          8 * 60 * 60
        );

        await expect(boardroom.connect(abuser).claimReward())
          .to.emit(boardroom, 'RewardPaid')
          .withArgs(abuser.address, SEIGNIORAGE_AMOUNT)

        expect(await share.balanceOf(abuser.address)).to.eq(ZERO);
        expect(await vault.balanceOf(abuser.address)).to.eq(STAKE_AMOUNT);
        expect(await cash.balanceOf(abuser.address)).to.eq(oldCashBalanceOfAbuser.add(SEIGNIORAGE_AMOUNT));
      });

      it('should earn 50% of the new rewards from the next epoch owning 50% of the pool', async () => {
        await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT)

        await advanceTimeAndBlock(
          provider,
          (12 * 60 * 60)
        );

        const oldCashBalanceOfAbuser = await cash.balanceOf(abuser.address);

        await vault.connect(abuser).bond(STAKE_AMOUNT);
        await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT)

        await advanceTimeAndBlock(
          provider,
          8 * 60 * 60
        );

        await expect(boardroom.connect(abuser).claimReward())
          .to.emit(boardroom, 'RewardPaid')
          .withArgs(abuser.address, SEIGNIORAGE_AMOUNT.div(2))

        expect(await share.balanceOf(abuser.address)).to.eq(ZERO);
        expect(await vault.balanceOf(abuser.address)).to.eq(STAKE_AMOUNT);

        // Divide by 2 since there are 2 stakers.
        expect(await cash.balanceOf(abuser.address)).to.eq(oldCashBalanceOfAbuser.add(SEIGNIORAGE_AMOUNT.div(2)));
      });

      it('should earn 100% of the new rewards from the next epoch after 3epoch owning 50% of the pool', async () => {
        await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT)

        await advanceTimeAndBlock(
          provider,
          (12 * 60 * 60)
        );

        const oldCashBalanceOfAbuser = await cash.balanceOf(abuser.address);

        await vault.connect(abuser).bond(STAKE_AMOUNT);
        await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT)

        await advanceTimeAndBlock(
          provider,
          12 * 60 * 60
        );

        await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT)

        await advanceTimeAndBlock(
          provider,
          8 * 60 * 60
        );

        await expect(boardroom.connect(abuser).claimReward())
          .to.emit(boardroom, 'RewardPaid')
          .withArgs(abuser.address, SEIGNIORAGE_AMOUNT)

        expect(await share.balanceOf(abuser.address)).to.eq(ZERO);
        expect(await vault.balanceOf(abuser.address)).to.eq(STAKE_AMOUNT);

        // Divide by 2 since there are 2 stakers.
        expect(await cash.balanceOf(abuser.address)).to.eq(oldCashBalanceOfAbuser.add(SEIGNIORAGE_AMOUNT));
      });

      it('should earn 150% of the new rewards from the next epoch after 4epoch owning 50% of the pool', async () => {
        await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT)

        await advanceTimeAndBlock(
          provider,
          (12 * 60 * 60)
        );

        const oldCashBalanceOfAbuser = await cash.balanceOf(abuser.address);

        await vault.connect(abuser).bond(STAKE_AMOUNT);
        await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT)

        await advanceTimeAndBlock(
          provider,
          12 * 60 * 60
        );

        await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT)


        await advanceTimeAndBlock(
          provider,
          12 * 60 * 60
        );

        await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT)

        await advanceTimeAndBlock(
          provider,
          8 * 60 * 60
        );

        await expect(boardroom.connect(abuser).claimReward())
          .to.emit(boardroom, 'RewardPaid')
          .withArgs(abuser.address, SEIGNIORAGE_AMOUNT.add(SEIGNIORAGE_AMOUNT.div(2)))

        expect(await share.balanceOf(abuser.address)).to.eq(ZERO);
        expect(await vault.balanceOf(abuser.address)).to.eq(STAKE_AMOUNT);

        // Divide by 2 since there are 2 stakers.
        expect(await cash.balanceOf(abuser.address)).to.eq(oldCashBalanceOfAbuser.add(SEIGNIORAGE_AMOUNT).add(SEIGNIORAGE_AMOUNT.div(2)));
      });
    })
  });
});

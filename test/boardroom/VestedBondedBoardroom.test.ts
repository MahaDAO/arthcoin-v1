import chai, { expect } from 'chai';
import { ethers } from 'hardhat';
import { solidity } from 'ethereum-waffle';
import { Contract, ContractFactory, BigNumber, utils } from 'ethers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';

import { advanceTimeAndBlock, latestBlocktime } from '../shared/utilities';
import { TREASURY_START_DATE } from '../../deploy.config';
// import { TREASURY_START_DATE } from '../../deploy.config';


chai.use(solidity);


describe('VestedBondedBoardroom', () => {
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

  before('Fetch contract factories', async () => {
    ARTH = await ethers.getContractFactory('ARTH');
    SHARE = await ethers.getContractFactory('MahaToken');
    VestedBondedBoardroom = await ethers.getContractFactory('VestedBondedBoardroom');
  });

  let cash: Contract;
  let share: Contract;
  let boardroom: Contract;

  beforeEach('Deploy contracts', async () => {
    cash = await ARTH.connect(operator).deploy();
    share = await SHARE.connect(operator).deploy();
    boardroom = await VestedBondedBoardroom.connect(operator).deploy(
      cash.address,
      share.address,
      BOARDROOM_LOCK_PERIOD,
      REWARDS_VESTING
    );
  });

  describe('#Bond', () => {
    it('Should work correctly', async () => {
      await Promise.all([
        share.connect(operator).mint(whale.address, STAKE_AMOUNT),
        share.connect(whale).approve(boardroom.address, STAKE_AMOUNT),
      ]);

      await expect(boardroom.connect(whale).bond(STAKE_AMOUNT))
        .to.emit(boardroom, 'Bonded')
        .withArgs(whale.address, STAKE_AMOUNT);

      const latestSnapshotIndex = await boardroom.latestSnapshotIndex();

      expect(await boardroom.balanceOf(whale.address)).to.eq(STAKE_AMOUNT);

      expect(await boardroom.getLastSnapshotIndexOf(whale.address)).to.eq(
        latestSnapshotIndex
      );
    });

    it('Should fail when user tries to bond with zero amount', async () => {
      await expect(boardroom.connect(whale).bond(ZERO)).to.revertedWith(
        'Boardroom: Cannot bond 0'
      );
    });

    it('Should fail when deposits are disabled', async () => {
      await boardroom.connect(operator).toggleDeposits(false);

      await expect(boardroom.connect(whale).bond(STAKE_AMOUNT)).to.revertedWith(
        'boardroom: deposits are disabled'
      );
    });
  });

  describe('#Unbond', async () => {
    beforeEach('Should be able to stake', async () => {
      await Promise.all([
        share.connect(operator).mint(whale.address, STAKE_AMOUNT),
        share.connect(whale).approve(boardroom.address, STAKE_AMOUNT),
      ]);

      await boardroom.connect(whale).bond(STAKE_AMOUNT);
    });

    it('Should work', async () => {
      await expect(boardroom.connect(whale).unbond(STAKE_AMOUNT))
        .to.emit(boardroom, 'Unbonded')
        .withArgs(whale.address, STAKE_AMOUNT);

      expect(await share.balanceOf(whale.address)).to.eq(ZERO);
      expect(await boardroom.balanceOf(whale.address)).to.eq(STAKE_AMOUNT);
    });

    it('Should fail when user tries to ubond with zero amount', async () => {
      await advanceTimeAndBlock(
        provider,
        (await latestBlocktime(provider)) + BOARDROOM_LOCK_PERIOD
      );

      await expect(boardroom.connect(whale).unbond(ZERO)).to.revertedWith(
        'Boardroom: Cannot unbond 0'
      );
    });

    it('Should fail when user tries to unbond more than staked amount', async () => {
      await advanceTimeAndBlock(
        provider,
        (await latestBlocktime(provider)) + BOARDROOM_LOCK_PERIOD
      );

      await expect(
        boardroom.connect(whale).unbond(STAKE_AMOUNT.add(1))
      ).to.revertedWith(
        'Boardroom: unbond request greater than staked amount'
      );
    });

    it('Should fail when non-director tries to withdraw', async () => {
      await advanceTimeAndBlock(
        provider,
        BOARDROOM_LOCK_PERIOD
      );

      await expect(boardroom.connect(abuser).unbond(ZERO)).to.revertedWith(
        'Boardroom: The director does not exist'
      );
    });
  });

  describe('#Withdraw', async () => {
    beforeEach('Should be able to stake', async () => {
      await Promise.all([
        share.connect(operator).mint(whale.address, STAKE_AMOUNT),
        share.connect(whale).approve(boardroom.address, STAKE_AMOUNT),
      ]);

      await boardroom.connect(whale).bond(STAKE_AMOUNT);
    });

    it('Should not be able to withdraw without unbonding and time < boardroomLockPeriod', async () => {
      await expect(boardroom.connect(whale).withdraw()).revertedWith('')

      expect(await share.balanceOf(whale.address)).to.eq(ZERO);
      expect(await boardroom.balanceOf(whale.address)).to.eq(STAKE_AMOUNT);
    });

    it('Should not be able to withdraw without unbonding and time > boardroomLockPeriod', async () => {
      await advanceTimeAndBlock(
        provider,
        (await latestBlocktime(provider)) + BOARDROOM_LOCK_PERIOD
      );

      await expect(boardroom.connect(whale).withdraw()).revertedWith('')

      expect(await share.balanceOf(whale.address)).to.eq(ZERO);
      expect(await boardroom.balanceOf(whale.address)).to.eq(STAKE_AMOUNT);
    });

    it('Should not be able to withdraw with unbonding and time < boardroomLockPeriod', async () => {
      await boardroom.connect(whale).unbond(STAKE_AMOUNT);

      await expect(boardroom.connect(whale).withdraw()).revertedWith('')

      expect(await share.balanceOf(whale.address)).to.eq(ZERO);
      expect(await boardroom.balanceOf(whale.address)).to.eq(STAKE_AMOUNT);
    });

    it('Should be able to withdraw with unbonding and time > boardroomLockPeriod', async () => {
      await boardroom.connect(whale).unbond(STAKE_AMOUNT);

      await advanceTimeAndBlock(
        provider,
        (await latestBlocktime(provider)) + BOARDROOM_LOCK_PERIOD
      );

      await expect(boardroom.connect(whale).withdraw())
        .to.emit(boardroom, 'Withdrawn')
        .withArgs(whale.address, STAKE_AMOUNT);

      expect(await share.balanceOf(whale.address)).to.eq(STAKE_AMOUNT);
      expect(await boardroom.balanceOf(whale.address)).to.eq(ZERO);
    });

    it('Should fail when non-director tries to withdraw', async () => {
      await advanceTimeAndBlock(
        provider,
        (await latestBlocktime(provider)) + BOARDROOM_LOCK_PERIOD
      );

      await expect(boardroom.connect(abuser).withdraw()).to.revertedWith(
        'Boardroom: The director does not exist'
      );
    });

    it('Should not be able to withdraw twice if only unbonded once', async () => {
      await boardroom.connect(whale).unbond(STAKE_AMOUNT);

      await advanceTimeAndBlock(
        provider,
        (await latestBlocktime(provider)) + BOARDROOM_LOCK_PERIOD
      );

      await expect(boardroom.connect(whale).withdraw())
        .to.emit(boardroom, 'Withdrawn')
        .withArgs(whale.address, STAKE_AMOUNT);

      expect(await share.balanceOf(whale.address)).to.eq(STAKE_AMOUNT);
      expect(await boardroom.balanceOf(whale.address)).to.eq(ZERO);

      await advanceTimeAndBlock(
        provider,
        (await latestBlocktime(provider)) + BOARDROOM_LOCK_PERIOD
      );

      await expect(boardroom.connect(whale).withdraw()).to.revertedWith(
        'Boardroom: The director does not exist'
      );
    });
  });

  describe('#Exit', async () => {
    beforeEach('Should be able to stake', async () => {
      await Promise.all([
        share.connect(operator).mint(whale.address, STAKE_AMOUNT),
        share.connect(whale).approve(boardroom.address, STAKE_AMOUNT),
      ]);

      await boardroom.connect(whale).bond(STAKE_AMOUNT);
    });

    it('Should not be able to exit without unbonding and time < boardroomLockPeriod', async () => {
      await expect(boardroom.connect(whale).exit()).revertedWith('')

      expect(await share.balanceOf(whale.address)).to.eq(ZERO);
      expect(await boardroom.balanceOf(whale.address)).to.eq(STAKE_AMOUNT);
    });

    it('Should not be able to exit without unbonding and time > boardroomLockPeriod', async () => {
      await advanceTimeAndBlock(
        provider,
        BOARDROOM_LOCK_PERIOD
      );

      await expect(boardroom.connect(whale).exit()).to.revertedWith('')

      expect(await share.balanceOf(whale.address)).to.eq(ZERO);
      expect(await boardroom.balanceOf(whale.address)).to.eq(STAKE_AMOUNT);
    });

    it('Should not be able to exit with unbonding and time < boardroomLockPeriod', async () => {
      await boardroom.connect(whale).unbond(STAKE_AMOUNT);

      await expect(boardroom.connect(whale).exit()).revertedWith('')

      expect(await share.balanceOf(whale.address)).to.eq(ZERO);
      expect(await boardroom.balanceOf(whale.address)).to.eq(STAKE_AMOUNT);
    });

    it('Should be able to exit with unbonding and time > boardroomLockPeriod', async () => {
      await boardroom.connect(whale).unbond(STAKE_AMOUNT);

      await advanceTimeAndBlock(
        provider,
        2 * BOARDROOM_LOCK_PERIOD
      );

      await expect(boardroom.connect(whale).exit())
        .to.emit(boardroom, 'Withdrawn')
        .withArgs(whale.address, STAKE_AMOUNT);

      expect(await share.balanceOf(whale.address)).to.eq(STAKE_AMOUNT);
      expect(await boardroom.balanceOf(whale.address)).to.eq(ZERO);
      expect(await cash.balanceOf(whale.address)).to.gte(ZERO); // Since no seigniorage is allocated.
    });

    it('Should fail when non-director tries to exit', async () => {
      await advanceTimeAndBlock(
        provider,
        BOARDROOM_LOCK_PERIOD
      );

      await expect(boardroom.connect(abuser).exit()).to.revertedWith(
        'Boardroom: The director does not exist'
      );
    });

    it('Should fail when director has already exited once', async () => {
      await boardroom.connect(whale).unbond(STAKE_AMOUNT);

      await advanceTimeAndBlock(
        provider,
        2 * BOARDROOM_LOCK_PERIOD
      );

      await expect(boardroom.connect(whale).exit())
        .to.emit(boardroom, 'Withdrawn')
        .withArgs(whale.address, STAKE_AMOUNT);

      expect(await share.balanceOf(whale.address)).to.eq(STAKE_AMOUNT);
      expect(await boardroom.balanceOf(whale.address)).to.eq(ZERO);
      expect(await cash.balanceOf(whale.address)).to.gte(ZERO); // Since no seigniorage is allocated.

      await expect(boardroom.connect(whale).exit()).to.reverted;
    });
  });

  describe('#AllocateSeigniorage', () => {
    beforeEach('Should be able to stake', async () => {
      await Promise.all([
        share.connect(operator).mint(whale.address, STAKE_AMOUNT),
        share.connect(whale).approve(boardroom.address, STAKE_AMOUNT),
      ]);

      await boardroom.connect(whale).bond(STAKE_AMOUNT);
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
        share.connect(whale).approve(boardroom.address, STAKE_AMOUNT),

        share.connect(operator).mint(abuser.address, STAKE_AMOUNT),
        share.connect(abuser).approve(boardroom.address, STAKE_AMOUNT),
      ]);

      await boardroom.connect(whale).bond(STAKE_AMOUNT);
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
      const expectedReward = earnedReward.mul(timelyRewardRatio);

      // NOTE: all mul and div from 1e18 are done for retaining
      // the precison
      await expect(boardroom.connect(whale).claimReward())
        .to.emit(boardroom, 'RewardPaid')
        .withArgs(whale.address, expectedReward.div(ETH));

      expect(await boardroom.balanceOf(whale.address)).to.eq(STAKE_AMOUNT);
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

      expect(await boardroom.balanceOf(whale.address)).to.eq(STAKE_AMOUNT);
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
      expect(await boardroom.balanceOf(whale.address)).to.eq(STAKE_AMOUNT);
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
      await boardroom.connect(abuser).bond(STAKE_AMOUNT);

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

      expect(await boardroom.balanceOf(whale.address)).to.eq(STAKE_AMOUNT);
      expect(await boardroom.balanceOf(abuser.address)).to.eq(STAKE_AMOUNT);
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

      await boardroom.connect(abuser).bond(STAKE_AMOUNT);

      await advanceTimeAndBlock(
        provider,
        8 * 60 * 60
      );

      await expect(boardroom.connect(whale).claimReward())
        .to.emit(boardroom, 'RewardPaid');

      expect(await share.balanceOf(whale.address)).to.eq(ZERO);
      expect(await cash.balanceOf(abuser.address)).to.eq(ZERO);
      expect(await share.balanceOf(abuser.address)).to.eq(ZERO);
      expect(await cash.balanceOf(whale.address)).to.eq(SEIGNIORAGE_AMOUNT);
      expect(await boardroom.balanceOf(whale.address)).to.eq(STAKE_AMOUNT);
      expect(await boardroom.balanceOf(abuser.address)).to.eq(STAKE_AMOUNT);
    });
  });
});

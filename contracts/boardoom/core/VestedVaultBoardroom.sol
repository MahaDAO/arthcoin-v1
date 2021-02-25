// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import {IERC20} from '@openzeppelin/contracts/contracts/token/ERC20/IERC20.sol';
import {SafeMath} from '@openzeppelin/contracts/contracts/math/SafeMath.sol';
import {Vault} from './Vault.sol';
import {VaultBoardroom} from './VaultBoardroom.sol';

contract VestedVaultBoardroom is VaultBoardroom {
    uint256 public vestFor;
    using SafeMath for uint256;

    /**
     * Event.
     */
    event VestingPeriodChanged(uint256 oldPeriod, uint256 period);

    /**
     * Constructor.
     */
    constructor(
        IERC20 token_,
        Vault vault_,
        uint256 vestFor_
    ) VaultBoardroom(token_, vault_) {
        vestFor = vestFor_;
    }

    // function claimed(address director) view return (uint256, uint256) {
    //     return (claimedThisEpoch, claimedSoFarInTotal)
    // }

    // function claimRewardsV2() {
    //     (rewardsEarnedThisEpoch, rewardsAccumulatedFromPrevEpochs) = earnedV2(msg.sender);

    //     // send rewardsAccumulatedFromPrevEpochs - claimedSoFarInTotal

    //     // vest rewardsEarnedThisEpoch - claimedThisEpoch

    //     // updated claimed state
    //     // claimedThisEpoch += (rewardsEarnedThisEpoch - claimedThisEpoch)
    //     // claimedSoFarInTotal += (rewardsAccumulatedFromPrevEpochs - claimedSoFarInTotal) + claimedThisEpoch
    // }

    /**
     * Views/Getters.
     */

    function earnedV2(address director) public view returns (uint256, uint256) {
        uint256 rewardsEarnedThisEpoch = 0;
        uint256 rewardsAccumulatedFromPrevEpochs = 0;

        uint256 latestRPS = getLatestSnapshot().rewardPerShare;
        uint256 claimedRPS = getLastSnapshotOf(director).rewardPerShare;

        uint256 rewardAlreadyEarnedInCurrEpoch =
            directors[director].rewardEarnedCurrEpoch;

        // Check if stored reward per share is 0 or not.
        if (claimedRPS == 0) {
            // If it's 0 that would mean, that the director has not even once claimed the rewards.
            // Hence, we take the storedRPS as the reward per share that was availabel when the director
            // first bonded and the boardroom was live.
            uint256 firstBondedSnapshotIndex =
                bondingHistory[director].snapshotIndexWhenFirstBonded;
            claimedRPS = boardHistory[firstBondedSnapshotIndex].rewardPerShare;
        }

        // This either will be based on the last time director claimed or first time director bonded
        // with this boardroom.
        uint256 lastRPS = claimedRPS;

        // Check if the boardroom has been allocated more than twice.
        if (boardHistory.length > 2) {
            if (
                // Makes sure that we have bonded before the latest allocation, only then run this code.
                // If check removed, we won't be able to bond for the newest allocation.
                bondingHistory[director].snapshotIndexWhenFirstBonded <
                latestSnapshotIndex() &&
                // Makes sure that we have not claimed in the same epoch or that
                // the latestEpoch > the one which we claim in.
                directors[director].lastSnapshotIndex <
                latestSnapshotIndex().sub(1)
            ) {
                // If it is, then there's a possibility that the director has claimed once before.
                // Hence, update the last allocation for reward per share,
                // to point to the 2nd last epoch that was allocated.
                lastRPS = boardHistory[latestSnapshotIndex().sub(1)]
                    .rewardPerShare;

                // Calculate the rewards from the 2nd last allocation point to the
                // point where director last claimed(or first bonded)
                // and mark them as pending, since they are from prev epochs.
                rewardsAccumulatedFromPrevEpochs = vault
                    .balanceWithoutBonded(director)
                    .mul(lastRPS.sub(claimedRPS))
                    .div(1e18);
            }
        }

        // Calcuate the reward earned from the current allocation to
        // the last allocation. If boardroom has been allocated only once,
        // then this will calculate the rewards till the start.
        rewardsEarnedThisEpoch = vault
            .balanceWithoutBonded(director)
            .mul(latestRPS.sub(lastRPS))
            .div(1e18);

        // Check if the last time we claimed was before the latest seigniorage allocations.
        if (
            directors[director].lastClaimedOn <
            boardHistory[latestSnapshotIndex()].time
        ) {
            // If it was then we add the pending rewards here.

            if (directors[director].rewardPending != 0)
                // NOTE: directors[director].rewardPending is updated in the _updateRewards func.
                rewardsAccumulatedFromPrevEpochs = rewardsAccumulatedFromPrevEpochs
                    .add(directors[director].rewardPending);
            else {
                rewardsAccumulatedFromPrevEpochs = rewardsAccumulatedFromPrevEpochs
                    .add(
                    directors[director].rewardEarnedCurrEpoch.sub(
                        directors[director].rewardClaimedCurrEpoch
                    )
                );
            }
        }

        // Check if there's some reward already earned in curr epoch and add to curr epoch rewards.
        if (rewardAlreadyEarnedInCurrEpoch > 0)
            rewardsEarnedThisEpoch = rewardsEarnedThisEpoch.add(
                rewardAlreadyEarnedInCurrEpoch
            );

        return (rewardsEarnedThisEpoch, rewardsAccumulatedFromPrevEpochs);
    }

    /**
     * Setters.
     */

    function estimateEarned(address director) public view returns (uint256) {
        uint256 rewardsEarnedThisEpoch = 0;
        uint256 rewardsAccumulatedFromPrevEpochs = 0;

        // Get the fresh rewards of this epoch.
        (rewardsEarnedThisEpoch, rewardsAccumulatedFromPrevEpochs) = earnedV2(
            director
        );

        return rewardsEarnedThisEpoch.add(rewardsAccumulatedFromPrevEpochs);
    }

    function setVestFor(uint256 period) public onlyOwner {
        emit VestingPeriodChanged(vestFor, period);
        vestFor = period;
    }

    function claimReward() public override directorExists returns (uint256) {
        _updateReward(msg.sender);

        // Get the current reward of the epoch.
        uint256 reward = directors[msg.sender].rewardEarnedCurrEpoch;
        if (reward <= 0) return 0;

        uint256 latestFundingTime = boardHistory[boardHistory.length - 1].time;

        // If past the vesting period, then claim entire reward.
        if (block.timestamp >= latestFundingTime.add(vestFor)) {
            // If past latest funding time and vesting period then we claim entire 100%
            // reward from both previous and current and subtract the reward already claimed
            // in this epoch.
            reward = reward.add(directors[msg.sender].rewardPending).sub(
                directors[msg.sender].rewardClaimedCurrEpoch
            );

            // Reset the counters to 0 as we claimed all.
            directors[msg.sender].rewardEarnedCurrEpoch = 0;
            directors[msg.sender].rewardPending = 0;
            directors[msg.sender].rewardClaimedCurrEpoch = 0;
        }
        // If not past the vesting period, then claim reward as per linear vesting.
        else {
            uint256 timeSinceLastFunded =
                block.timestamp.sub(latestFundingTime);

            // Calculate reward to be given assuming msg.sender has not claimed in current
            // vesting cycle(8hr cycle).
            // NOTE: here we are multiplying by 1e3 to get precise decimal values.
            uint256 timelyRewardRatio =
                timeSinceLastFunded.mul(1e3).div(vestFor);

            if (directors[msg.sender].lastClaimedOn > latestFundingTime) {
                /*
                  And if msg.sender has claimed atleast once after the new vesting kicks in,
                  then we need to find the ratio for current time.

                  Let's say we want vesting to be for 10 seconds.
                  Then if we try to claim rewards at every 1 second then, we should get
                  1/10 of the rewards every second.
                  So for 1st second reward could be 1/10, for next also 1/10, we can convert
                  this to `(timeNext-timeOld)/timePeriod`.
                  For 1st second: (1-0)/10
                  For 2nd second: (2-1)/10
                  and so on.
                */
                uint256 timeSinceLastClaimed =
                    block.timestamp.sub(directors[msg.sender].lastClaimedOn);

                // NOTE: here we are multiplying by 1e3 to get precise decimal values.
                timelyRewardRatio = timeSinceLastClaimed.mul(1e3).div(vestFor);
            }

            // Update reward as per vesting.
            // NOTE: here we are nullyfying the multplication by 1e3 effect on the top.
            reward = timelyRewardRatio.mul(reward).div(1e3);

            // We add the reward claimed in this epoch to the variables.
            // We basically do this to maintain a log of original reward, so we use that in
            // vesting. and we use this counter to know how much from the original reward
            // we have claimed in the current claim under the vesting period. Otherwise it becomes
            // kind of curve vesting.
            directors[msg.sender].rewardClaimedCurrEpoch = (
                directors[msg.sender].rewardClaimedCurrEpoch.add(reward)
            );

            // If this is the first claim inside this vesting period, then we also
            // give away 100% of previous vesting period's pending rewards.
            if (directors[msg.sender].lastClaimedOn < latestFundingTime) {
                // HERE since this is the first claim we don't need to subtract claim reward in this epoch variable.
                reward = reward.add(directors[msg.sender].rewardPending);
                directors[msg.sender].rewardPending = 0;
            }
        }

        directors[msg.sender].lastClaimedOn = block.timestamp;

        token.transfer(msg.sender, reward);
        emit RewardPaid(msg.sender, reward);

        return reward;
    }

    function claimAndReinvestReward() external virtual {
        uint256 reward = claimReward();
        // NOTE: amount has to be approved from the frontend.
        vault.bondFor(msg.sender, reward);
    }

    function updateReward(address director) public onlyVault {
        BondingSnapshot storage snapshot = bondingHistory[director];

        uint256 latestSnapshotIdx = latestSnapshotIndex();

        // Check if we are bonding for the first time in this boardroom and update the state if
        // we are.
        if (
            snapshot.firstBondedOn == 0 &&
            snapshot.snapshotIndexWhenFirstBonded == 0
        ) {
            snapshot.firstBondedOn = block.timestamp;
            snapshot.snapshotIndexWhenFirstBonded = latestSnapshotIdx;
        }

        _updateReward(director);

        // Check if we are withdrawing.
        if (
            snapshot.firstBondedOn != 0 &&
            snapshot.snapshotIndexWhenFirstBonded != 0 &&
            vault.balanceOf(director) == 0
        ) {
            snapshot.firstBondedOn = 0;
            snapshot.snapshotIndexWhenFirstBonded = 0;
        }

        // Update the balance while recording this activity(whether withdraw of bond).
        uint256 balance = vault.balanceWithoutBonded(director);
        directorBalanceForEpoch[director][latestSnapshotIdx] = balance;
    }

    function _updateReward(address director) private {
        Boardseat storage seat = directors[director];
        uint256 latestFundingTime = boardHistory[boardHistory.length - 1].time;

        // Check if we are claiming for the first time in the latest epoch.
        if (seat.lastClaimedOn < latestFundingTime) {
            // If we are then we mark the overall reward of the current epoch minus
            // the reward already claimed in curr epoch as pending.
            seat.rewardPending = seat.rewardEarnedCurrEpoch.sub(
                seat.rewardClaimedCurrEpoch
            );

            // Reset the counters for the latest epoch.
            seat.rewardEarnedCurrEpoch = 0;
            seat.rewardClaimedCurrEpoch = 0;
        }

        uint256 rewardsEarnedThisEpoch = 0;
        uint256 rewardsAccumulatedFromPrevEpochs = 0;
        // Get the fresh rewards of this epoch.
        (rewardsEarnedThisEpoch, rewardsAccumulatedFromPrevEpochs) = earnedV2(
            director
        );

        seat.rewardPending = rewardsAccumulatedFromPrevEpochs;
        seat.rewardEarnedCurrEpoch = rewardsEarnedThisEpoch;
        seat.lastSnapshotIndex = latestSnapshotIndex();
    }
}

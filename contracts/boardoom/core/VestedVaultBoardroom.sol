// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import {IERC20} from '@openzeppelin/contracts/contracts/token/ERC20/IERC20.sol';
import {SafeMath} from '@openzeppelin/contracts/contracts/math/SafeMath.sol';
import {Vault} from './Vault.sol';
import {VaultBoardroom} from './VaultBoardroom.sol';

contract VestedVaultBoardroom is VaultBoardroom {
    // For how much time should vesting take place.
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

    /**
     * Views/Getters.
     */
    function earned(address director) internal override returns (uint256) {
        uint256 latestRPS = getLatestSnapshot().rewardPerShare;
        uint256 storedRPS = getLastSnapshotOf(director).rewardPerShare;

        uint256 prevRewards = 0;
        uint256 latestFundingTime = boardHistory[boardHistory.length - 1].time;

        // If last time rewards claimed were less than the latest epoch start time,
        // then we don't consider those rewards in further calculations and mark them
        // as pending.
        uint256 rewardEarnedCurrEpoch =
            (
                directors[director].lastClaimedOn < latestFundingTime
                    ? 0
                    : directors[director].rewardEarnedCurrEpoch
            );

        // If storedRPS is 0, that means we are claiming rewards for the first time, hence we need
        // to check when we bonded and accordingly calculate the final rps.
        if (storedRPS == 0) {
            uint256 firstBondedSnapshotIndex =
                bondingHistory[director].snapshotIndex;
            storedRPS = boardHistory[firstBondedSnapshotIndex].rewardPerShare;
        }

        if (boardHistory.length > 2) {
            if (
                bondingHistory[director].snapshotIndex < latestSnapshotIndex()
            ) {
                uint256 lastRPS =
                    boardHistory[latestSnapshotIndex().sub(1)].rewardPerShare;

                uint256 prevToPrevEpochsRewardEarned =
                    (
                        directors[director].lastClaimedOn < latestFundingTime
                            ? 0
                            : directors[director].rewardEarnedCurrEpoch
                    );

                prevRewards = vault
                    .balanceWithoutBonded(director)
                    .mul(lastRPS.sub(storedRPS))
                    .div(1e18);

                prevRewards = prevRewards.add(prevToPrevEpochsRewardEarned);

                directors[director].rewardPending = directors[director]
                    .rewardPending
                    .add(prevRewards);
            }
        }

        uint256 rewards =
            vault
                .balanceWithoutBonded(director)
                .mul(latestRPS.sub(storedRPS))
                .div(1e18)
                .add(rewardEarnedCurrEpoch);

        return rewards.sub(prevRewards);
    }

    /**
     * Setters.
     */
    function setVestFor(uint256 period) public onlyOwner {
        emit VestingPeriodChanged(vestFor, period);
        vestFor = period;
    }

    function claimReward() public override directorExists returns (uint256) {
        _updateReward(msg.sender);

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
        vault.bondFor(msg.sender, reward);
    }

    function updateReward(address director) public onlyVault {
        BondingSnapshot storage snapshot = bondingHistory[director];

        uint256 latestSnapshotIdx = latestSnapshotIndex();

        // This means, we are bonding for the first time.
        // Hence we save the timestamp when, we first bond and the
        // allocation index no. when we first bond.
        if (snapshot.firstOn == 0 && snapshot.snapshotIndex == 0) {
            snapshot.firstOn = block.timestamp;
            // NOTE: probably will revert/throw error in case not allocated yet.
            snapshot.snapshotIndex = latestSnapshotIdx;
        }

        // Anyways, the balanceWIthBonded would be 0 if we are withdrawing.
        _updateReward(director);

        // This means we are not the first time bonding, and withdrawing.
        if (
            snapshot.firstOn != 0 &&
            snapshot.snapshotIndex != 0 &&
            vault.balanceOf(director) == 0
        ) {
            snapshot.firstOn = 0;
            snapshot.snapshotIndex = 0;
        }

        // Update the balance while recording this activity(whether withdraw of bond).
        uint256 balance = vault.balanceWithoutBonded(director);
        directorBalanceForEpoch[director][latestSnapshotIdx] = balance;
    }

    function _updateReward(address director) private {
        Boardseat storage seat = directors[director];

        // Set the default latest funding time to 0.
        // This represents that boardroom has not been allocated seigniorage yet.
        uint256 latestFundingTime = boardHistory[boardHistory.length - 1].time;

        // If rewards are updated before epoch start of the current,
        // then we mark claimable rewards as pending and set the
        // current earned rewards to 0.
        if (seat.lastClaimedOn < latestFundingTime) {
            // This basically set's current reward's which are not claimed as pending.
            // Since the user's last claim was before  the
            // latestFundingTime(epoch timestamp when allocated latest).
            seat.rewardPending = seat.rewardEarnedCurrEpoch.sub(
                seat.rewardClaimedCurrEpoch
            );
            // Reset the counters for the latest epoch.
            seat.rewardEarnedCurrEpoch = 0;
            seat.rewardClaimedCurrEpoch = 0;
        }

        // Generate fresh rewards for the current epoch.
        // This should only include reward for curr epoch.
        // If any remaining they are makred as pending.
        seat.rewardEarnedCurrEpoch = earned(director);
        // Update the last allocation index no. when claimed.
        seat.lastSnapshotIndex = latestSnapshotIndex();
    }
}

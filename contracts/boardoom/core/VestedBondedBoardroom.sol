// SPDX-License-Identifier: MIT

pragma solidity ^0.6.12;
// pragma experimental ABIEncoderV2;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';

import './BondedBoardroom.sol';

contract VestedBondedBoardroom is BondedBoardroom {
    // For how much time should vesting take place.
    uint256 public vestFor = 8 hours;

    constructor(
        IERC20 _cash,
        IERC20 _share,
        uint256 _duration
    ) public BondedBoardroom(_cash, _share, _duration) {}

    modifier updateVestedReward(address director) {
        if (director != address(0)) {
            Boardseat storage seat = directors[director];

            uint256 latestFundingTime =
                boardHistory[boardHistory.length - 1].time;
            uint256 previousFundingTime =
                (
                    boardHistory.length > 1
                        ? boardHistory[boardHistory.length - 2].time
                        : 0
                );

            // If rewards are updated before epoch start of the current,
            // then we mark claimable rewards as pending and set the
            // current earned rewards to 0.
            if (seat.lastClaimedOn < latestFundingTime) {
                seat.rewardPending = seat.rewardEarned;
                seat.rewardEarned = 0;
            }

            uint256 freshReward = earned(director);

            seat.rewardEarned = freshReward;
            seat.lastSnapshotIndex = latestSnapshotIndex();
        }

        _;
    }

    function earned(address director) public view override returns (uint256) {
        uint256 latestRPS = getLatestSnapshot().rewardPerShare;
        uint256 storedRPS = getLastSnapshotOf(director).rewardPerShare;

        // If last time rewards claimed were less than the latest epoch start time,
        // then we don't consider those rewards in further calculations and mark them
        // as pending.
        uint256 latestFundingTime = boardHistory[boardHistory.length - 1].time;
        uint256 rewardEarned =
            (
                directors[director].lastClaimedOn < latestFundingTime
                    ? 0
                    : directors[director].rewardEarned
            );

        return
            balanceOf(director).mul(latestRPS.sub(storedRPS)).div(1e18).add(
                rewardEarned
            );
    }

    /**
     * Mutations.
     */

    function setVestFor(uint256 period) public onlyOwner {
        emit VestingPeriodChanged(vestFor, period);
        vestFor = period;
    }

    function _claimAndQuit() private updateVestedReward(msg.sender) {
        uint256 rewardLeftToClaim = directors[msg.sender].rewardEarned;
        uint256 rewardPending = directors[msg.sender].rewardPending;

        uint256 reward = rewardLeftToClaim.add(rewardPending);
        if (reward <= 0) return;

        // All rewards are claimed, whether pending or claimable under
        // current epoch.
        directors[msg.sender].rewardEarned = 0;
        directors[msg.sender].rewardPending = 0;
        directors[msg.sender].lastClaimedOn = block.timestamp;

        cash.safeTransfer(msg.sender, reward);

        emit RewardPaid(msg.sender, reward);
    }

    function exit() external override {
        withdraw();
        _claimAndQuit();
    }

    function claimReward() public override updateVestedReward(msg.sender) {
        uint256 reward = directors[msg.sender].rewardEarned;
        if (reward <= 0) return;

        uint256 latestFundingTime = boardHistory[boardHistory.length - 1].time;

        // If past the vesting period, then claim entire reward.
        if (block.timestamp >= latestFundingTime.add(vestFor)) {
            // If past latest funding time and vesting period then we claim entire 100%
            // reward from both previous and current.
            reward = reward.add(directors[msg.sender].rewardPending);

            directors[msg.sender].rewardEarned = 0;
            directors[msg.sender].rewardPending = 0;
        }
        // If not past the vesting period, then claim reward as per linear vesting.
        else {
            uint256 timeSinceLastFunded =
                block.timestamp.sub(latestFundingTime);

            // Calculate reward to be given assuming msg.sender has not claimed in current
            // vesting cycle(8hr cycle).
            uint256 timelyRewardRatio =
                timeSinceLastFunded.mul(1e18).div(vestFor);

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
                timelyRewardRatio = timeSinceLastClaimed.mul(1e18).div(vestFor);
            }

            // Update reward as per vesting.
            reward = timelyRewardRatio.mul(reward).div(1e18);

            directors[msg.sender].rewardEarned = (
                directors[msg.sender].rewardEarned.sub(reward)
            );

            // If this is the first claim inside this vesting period, then we also
            // give away 100% of previous vesting period's pending rewards.
            if (directors[msg.sender].lastClaimedOn < latestFundingTime) {
                reward = reward.add(directors[msg.sender].rewardPending);
                directors[msg.sender].rewardPending = 0;
            }
        }

        directors[msg.sender].lastClaimedOn = block.timestamp;

        cash.safeTransfer(msg.sender, reward);

        emit RewardPaid(msg.sender, reward);
    }

    /**
     * Events
     */
    event VestingPeriodChanged(uint256 oldPeriod, uint256 period);
}

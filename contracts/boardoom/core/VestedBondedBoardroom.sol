// SPDX-License-Identifier: MIT

pragma solidity ^0.6.12;
// pragma experimental ABIEncoderV2;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';

import '../../lib/Safe112.sol';
import './BondedShareWrapper.sol';
import '../../utils/ContractGuard.sol';
import '../../interfaces/IBasisAsset.sol';

contract VestedBondedBoardroom is BondedShareWrapper, ContractGuard {
    using SafeERC20 for IERC20;
    using Address for address;
    using SafeMath for uint256;
    using Safe112 for uint112;

    /**
     * Data structures.
     */

    struct Boardseat {
        // Pending reward from the previous epochs.
        uint256 rewardPending;
        // Total reward earned in this epoch.
        uint256 rewardEarned;
        // Last time reward was claimed(not bound by current epoch).
        uint256 lastClaimedOn;
        // Snapshot of boardroom state when last claimed(not bound by current epoch).
        uint256 lastSnapshotIndex;
    }

    struct BoardSnapshot {
        // Block number when recording a snapshot.
        uint256 number;
        // Block timestamp when recording a snapshot.
        uint256 time;
        // Amount of funds received.
        uint256 rewardReceived;
        // Equivalent amount per share staked.
        uint256 rewardPerShare;
    }

    /**
     * State variables.
     */

    IERC20 public cash;
    // For how much time should vesting take place.
    uint256 public vestFor = 8 hours;

    BoardSnapshot[] private boardHistory;
    mapping(address => Boardseat) private directors;

    /**
     * Constructor.
     */
    constructor(
        IERC20 _cash,
        IERC20 _share,
        uint256 _duration
    ) public StakingTimelock(_duration) {
        cash = _cash;
        share = _share;

        BoardSnapshot memory genesisSnapshot =
            BoardSnapshot({
                number: block.number,
                time: 0,
                rewardReceived: 0,
                rewardPerShare: 0
            });
        boardHistory.push(genesisSnapshot);
    }

    /**
     * Modifiers.
     */

    modifier directorExists {
        require(
            balanceOf(msg.sender) > 0,
            'Boardroom: The director does not exist'
        );

        _;
    }

    modifier updateReward(address director) {
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

    /**
     * Views.
     */

    function latestSnapshotIndex() public view returns (uint256) {
        return boardHistory.length.sub(1);
    }

    function getLatestSnapshot() internal view returns (BoardSnapshot memory) {
        return boardHistory[latestSnapshotIndex()];
    }

    function getLastSnapshotIndexOf(address director)
        public
        view
        returns (uint256)
    {
        return directors[director].lastSnapshotIndex;
    }

    function getLastSnapshotOf(address director)
        internal
        view
        returns (BoardSnapshot memory)
    {
        return boardHistory[getLastSnapshotIndexOf(director)];
    }

    function rewardPerShare() public view returns (uint256) {
        return getLatestSnapshot().rewardPerShare;
    }

    function earned(address director) public view returns (uint256) {
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

    function setVestFor(uint256 period) public onlyOperator {
        require(period > 0, 'Boardoom: period is 0');

        uint256 oldPeriod = vestFor;
        vestFor = period;

        emit PeriodChanged(oldPeriod, period);
    }

    function bond(uint256 amount)
        public
        override
        onlyOneBlock
        updateReward(msg.sender)
    {
        require(amount > 0, 'Boardroom: Cannot stake 0');

        super.bond(amount);

        emit Bonded(msg.sender, amount);
    }

    function unbond(uint256 amount)
        public
        override
        onlyOneBlock
        directorExists
        updateReward(msg.sender)
    {
        require(amount > 0, 'Boardroom: Cannot unbond 0');

        super.unbond(amount);

        emit Unbonded(msg.sender, amount);
    }

    function withdraw(uint256 amount)
        public
        override
        onlyOneBlock
        directorExists
        updateReward(msg.sender)
    {
        require(amount > 0, 'Boardroom: Cannot withdraw 0');

        super.withdraw(amount);

        emit Withdrawn(msg.sender, amount);
    }

    function _claimAndQuit() private updateReward(msg.sender) {
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

    function exit() external {
        withdraw(balanceOf(msg.sender));

        _claimAndQuit();
    }

    function claimReward() public updateReward(msg.sender) {
        uint256 reward = directors[msg.sender].rewardEarned;
        if (reward <= 0) return;

        uint256 latestFundingTime = boardHistory[boardHistory.length - 1].time;

        // If past the vesting period, then claim entire reward.
        if (block.timestamp >= latestFundingTime.add(vestFor)) {
            directors[msg.sender].rewardEarned = 0;
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
            // If this is the first claim inside this vesting period, then we also
            // give away 100% of previous vesting period's pending rewards.
            if (directors[msg.sender].lastClaimedOn < latestFundingTime)
                reward = reward.add(directors[msg.sender].rewardPending);

            directors[msg.sender].rewardEarned = (
                directors[msg.sender].rewardEarned.sub(reward)
            );
        }
        directors[msg.sender].lastClaimedOn = block.timestamp;

        cash.safeTransfer(msg.sender, reward);

        emit RewardPaid(msg.sender, reward);
    }

    function allocateSeigniorage(uint256 amount)
        external
        onlyOneBlock
        onlyOperator
    {
        require(amount > 0, 'Boardroom: Cannot allocate 0');

        // Boardroom: Cannot allocate when totalSupply is 0.
        if (totalSupply() == 0) return;

        // Create & add new snapshot.
        uint256 prevRPS = getLatestSnapshot().rewardPerShare;
        uint256 nextRPS = prevRPS.add(amount.mul(1e18).div(totalSupply()));

        BoardSnapshot memory newSnapshot =
            BoardSnapshot({
                number: block.number,
                time: block.timestamp,
                rewardReceived: amount,
                rewardPerShare: nextRPS
            });
        boardHistory.push(newSnapshot);

        cash.safeTransferFrom(msg.sender, address(this), amount);

        emit RewardAdded(msg.sender, amount);
    }

    /**
     * Events
     */

    event Bonded(address indexed user, uint256 amount);
    event Unbonded(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event RewardPaid(address indexed user, uint256 reward);
    event PeriodChanged(uint256 oldPeriod, uint256 period);
    event RewardAdded(address indexed user, uint256 reward);
}

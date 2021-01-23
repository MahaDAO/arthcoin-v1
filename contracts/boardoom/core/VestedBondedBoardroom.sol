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
        uint256 rewardEarned;
        uint256 rewardClaimed;
        uint256 rewardUnclaimed;
        uint256 lastClaimedOn;
        uint256 lastSnapshotIndex;
    }

    struct BoardSnapshot {
        uint256 time;
        uint256 rewardReceived;
        uint256 rewardPerShare;
    }

    /**
     * State variables.
     */

    IERC20 public cash;

    mapping(address => Boardseat) private directors;
    BoardSnapshot[] private boardHistory;

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
                time: block.number,
                rewardReceived: 0,
                rewardPerShare: 0
            });
        boardHistory.push(genesisSnapshot);
    }

    /**
     * Modifiers
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

            uint256 reward = earned(director);

            seat.rewardEarned = reward;
            seat.rewardUnclaimed = reward.sub(seat.rewardClaimed);
            seat.lastSnapshotIndex = latestSnapshotIndex();
            directors[director] = seat;
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

        return
            balanceOf(director).mul(latestRPS.sub(storedRPS)).div(1e18).add(
                directors[director].rewardEarned
            );
    }

    /**
     * Mutations.
     */

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
        updateReward(msg.sender)
    {
        require(amount > 0, 'Boardroom: Cannot stake 0');

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

    function _claimAndQuit() private updateReward(msg.sender) directorExists {
        uint256 reward = directors[msg.sender].rewardUnclaimed;

        if (reward > 0) {
            directors[msg.sender].rewardUnclaimed = 0;
            directors[msg.sender].rewardClaimed = (
                directors[msg.sender].rewardClaimed.add(reward)
            );

            cash.safeTransfer(msg.sender, reward);

            emit RewardPaid(msg.sender, reward);
        }
    }

    function exit() external {
        withdraw(balanceOf(msg.sender));

        _claimAndQuit();
    }

    function claimReward() public updateReward(msg.sender) {
        uint256 reward = directors[msg.sender].rewardEarned;

        // TODO: add vesting
        if (reward > 0) {
            directors[msg.sender].rewardEarned = 0;
            cash.safeTransfer(msg.sender, reward);

            emit RewardPaid(msg.sender, reward);
        }
    }

    function allocateSeigniorage(uint256 amount)
        external
        onlyOneBlock
        onlyOperator
    {
        require(amount > 0, 'Boardroom: Cannot allocate 0');

        // 'Boardroom: Cannot allocate when totalSupply is 0'
        if (totalSupply() == 0) return;

        // Create & add new snapshot
        uint256 prevRPS = getLatestSnapshot().rewardPerShare;
        uint256 nextRPS = prevRPS.add(amount.mul(1e18).div(totalSupply()));

        BoardSnapshot memory newSnapshot =
            BoardSnapshot({
                time: block.number,
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
    event RewardAdded(address indexed user, uint256 reward);
}

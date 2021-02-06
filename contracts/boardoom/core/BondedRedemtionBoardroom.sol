// SPDX-License-Identifier: MIT

pragma solidity ^0.6.12;
// pragma experimental ABIEncoderV2;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';

import '../../lib/Safe112.sol';
import './BondedTokenWrapper.sol';
import '../../utils/ContractGuard.sol';
import '../../interfaces/IBasisAsset.sol';
import '../../interfaces/ISimpleOracle.sol';

contract BondedRedemtionBoardroom is BondedTokenWrapper, ContractGuard {
    using SafeERC20 for IERC20;
    using Address for address;
    using SafeMath for uint256;
    using Safe112 for uint112;

    /* ========== DATA STRUCTURES ========== */

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

    /* ========== STATE VARIABLES ========== */

    // eg: a 1% fee means that while redeeming 100 ARTHB, 1 ARTH worth of MAHA is
    // deducted to pay for stability fees.
    uint256 public stabilityFee = 1; // IN %;

    // This token will be used to charge stability fee.
    IERC20 public feeToken;
    // This is the main fund token.
    IERC20 public cash;

    // Oracle used to track cash and share prices.
    ISimpleOracle arthMahaOracle;

    mapping(address => Boardseat) internal directors;
    BoardSnapshot[] internal boardHistory;

    /* ========== CONSTRUCTOR ========== */

    constructor(
        IERC20 _cash,
        IERC20 _share,
        IERC20 _feeToken,
        ISimpleOracle _arthMahaOracle,
        uint256 _duration
    ) public StakingTimelock(_duration) {
        cash = _cash;
        feeToken = _feeToken;
        share = _share;

        arthMahaOracle = _arthMahaOracle;

        BoardSnapshot memory genesisSnapshot =
            BoardSnapshot({
                number: block.number,
                time: 0,
                rewardReceived: 0,
                rewardPerShare: 0
            });
        boardHistory.push(genesisSnapshot);
    }

    /* ========== Modifiers =============== */
    modifier directorExists {
        require(
            balanceOf(msg.sender) > 0,
            'Boardroom: The director does not exist'
        );
        _;
    }

    modifier updateReward(address director) {
        if (director != address(0)) {
            Boardseat memory seat = directors[director];
            seat.rewardEarned = earned(director);
            seat.lastSnapshotIndex = latestSnapshotIndex();
            directors[director] = seat;
        }

        _;
    }

    /* ========== VIEW FUNCTIONS ========== */

    // =========== Snapshot getters

    function getArthMahaOraclePrice() public view returns (uint256) {
        return arthMahaOracle.getPrice();
    }

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

    // =========== Director getters

    function rewardPerShare() public view returns (uint256) {
        return getLatestSnapshot().rewardPerShare;
    }

    function earned(address director) public view virtual returns (uint256) {
        uint256 latestRPS = getLatestSnapshot().rewardPerShare;
        uint256 storedRPS = getLastSnapshotOf(director).rewardPerShare;

        return
            balanceOf(director).mul(latestRPS.sub(storedRPS)).div(1e18).add(
                directors[director].rewardEarned
            );
    }

    /* ========== MUTATIVE FUNCTIONS ========== */

    function bond(uint256 amount)
        public
        override
        onlyOneBlock
        updateReward(msg.sender)
    {
        super.bond(amount);
    }

    function unbond(uint256 amount)
        public
        override
        onlyOneBlock
        directorExists
        updateReward(msg.sender)
    {
        super.unbond(amount);
    }

    function withdraw()
        public
        override
        onlyOneBlock
        directorExists
        updateReward(msg.sender)
    {
        super.withdraw();
    }

    function exit() external virtual {
        withdraw();
        claimReward();
    }

    function claimReward() public virtual updateReward(msg.sender) {
        uint256 reward = directors[msg.sender].rewardEarned;

        if (reward > 0) {
            directors[msg.sender].rewardEarned = 0;
            cash.safeTransfer(msg.sender, reward);

            emit RewardPaid(msg.sender, reward);
        }
    }

    function allocateBonds(uint256 amount) external onlyOneBlock onlyOperator {
        require(amount > 0, 'Boardroom: Cannot allocate 0');

        // 'Boardroom: Cannot allocate when totalSupply is 0'
        if (totalSupply() == 0) return;

        // Create & add new snapshot
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

    /* ========== EVENTS ========== */

    event RewardPaid(address indexed user, uint256 reward);
    event RewardAdded(address indexed user, uint256 reward);
}

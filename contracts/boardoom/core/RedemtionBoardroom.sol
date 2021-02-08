// SPDX-License-Identifier: MIT

pragma solidity ^0.6.12;
// pragma experimental ABIEncoderV2;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';

import '../../lib/Safe112.sol';
import './SimpleTokenWrapper.sol';
import '../../utils/ContractGuard.sol';
import '../../interfaces/IBasisAsset.sol';
import '../../interfaces/ICustomERC20.sol';
import '../../interfaces/ISimpleOracle.sol';

abstract contract RedemtionBoardroom is SimpleTokenWrapper, ContractGuard {
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

    // stability fee is a special fee charged by the protocol in MAHA tokens
    // whenever a person is going to redeem his/her bonds. the fee is charged
    // basis how much ARTHB is being redeemed.
    //
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
        ISimpleOracle _arthMahaOracle
    ) public StakingTimelock(0) {
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

    /* ========== VIEW FUNCTIONS ========== */

    // =========== Snapshot getters

    function getArthMahaOraclePrice() public view returns (uint256) {
        return arthMahaOracle.getPrice();
    }

    function modifyArthMahaOracle(address newOracle) public onlyOwner {
        require(newOracle != address(0), 'Pool: invalid oracle');

        address oldOracle = address(arthMahaOracle);
        arthMahaOracle = ISimpleOracle(newOracle);

        emit OracleChanged(oldOracle, newOracle);
    }

    function modifyFeeToken(address newToken) public onlyOwner {
        require(newToken != address(0), 'Pool: invalid token');

        address oldToken = address(feeToken);
        feeToken = IERC20(newToken);

        emit FeeTokenChanged(oldToken, newToken);
    }

    function modifyStabilityFee(uint256 newFee) public onlyOwner {
        require(newFee >= 0, 'Pool: invalid fee range');
        stabilityFee = newFee;
        emit StabilityFeesChanged(newFee);
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

    /* ========== MUTATIVE FUNCTIONS ========== */

    function chargeStabilityFee(uint256 amount) internal {
        uint256 stabilityFeeInARTH = amount.mul(stabilityFee).div(100);
        uint256 stabilityFeeInMAHA =
            getArthMahaOraclePrice().mul(stabilityFeeInARTH).div(1e18);

        // charge the stability fee
        // NOTE: here feeToken represents the MAHA tokens.
        ICustomERC20(address(feeToken)).burnFrom(
            msg.sender,
            stabilityFeeInMAHA
        );

        emit StabilityFeesCharged(msg.sender, stabilityFeeInMAHA);
    }

    function allocateSeigniorage(uint256 amount)
        external
        override
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
                number: block.number,
                time: block.timestamp,
                rewardReceived: amount,
                rewardPerShare: nextRPS
            });
        boardHistory.push(newSnapshot);

        // NOTE: here cash represents the actual cash ARTH tokens.
        cash.safeTransferFrom(msg.sender, address(this), amount);

        emit RewardAdded(msg.sender, amount);
    }

    /* ========== EVENTS ========== */

    event RewardPaid(address indexed user, uint256 reward);
    event RewardAdded(address indexed user, uint256 reward);
    event StabilityFeesCharged(address indexed user, uint256 amount);
    event FeeTokenChanged(address oldToken, address newToken);
    event StabilityFeesChanged(uint256 newFee);
    event OracleChanged(address oldOracle, address newOracle);
}

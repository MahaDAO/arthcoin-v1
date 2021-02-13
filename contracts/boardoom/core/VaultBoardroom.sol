// SPDX-License-Identifier: MIT

pragma solidity ^0.6.12;
// pragma experimental ABIEncoderV2;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';

import './Vault.sol';
import '../../lib/Safe112.sol';
import '../../utils/ContractGuard.sol';
import '../../interfaces/IBasisAsset.sol';

contract VaultBoardroom is ContractGuard {
    using Safe112 for uint112;
    using Address for address;
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

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

    // The vault which has state of the stakes.
    Vault public vault;
    // Reward asset.
    IERC20 public cash;

    BoardSnapshot[] internal boardHistory;
    mapping(address => Boardseat) internal directors;

    /**
     * Modifier.
     */
    // modifier directorExists {
    //     require(
    //         vault.balanceOf(msg.sender) > 0,
    //         'Boardroom: The director does not exist'
    //     );
    //     _;
    // }

    /**
     * Events.
     */

    event RewardPaid(address indexed user, uint256 reward);
    event RewardAdded(address indexed user, uint256 reward);

    /**
     * Constructor.
     */
    constructor(IERC20 cash_, Vault vault_) public {
        cash = cash_;
        vault = vault_;

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
     * Views/Getters.
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

    function earned(address director) public view virtual returns (uint256) {
        uint256 latestRPS = getLatestSnapshot().rewardPerShare;
        uint256 storedRPS = getLastSnapshotOf(director).rewardPerShare;

        return
            vault
                .balanceWithoutBonded(director)
                .mul(latestRPS.sub(storedRPS))
                .div(1e18)
                .add(directors[director].rewardEarned);
    }

    /**
     * Mutations.
     */

    function updateReward(address director) private {
        if (director != address(0)) {
            Boardseat memory seat = directors[director];
            seat.rewardEarned = earned(director);
            seat.lastSnapshotIndex = latestSnapshotIndex();
            directors[director] = seat;
        }
    }

    function exit() external virtual {
        vault.withdraw();
        claimReward();
    }

    function claimReward() public virtual {
        updateReward(msg.sender);
        uint256 reward = directors[msg.sender].rewardEarned;

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

        uint256 totalSupply = vault.totalSupply();

        // 'Boardroom: Cannot allocate when totalSupply is 0'
        if (totalSupply == 0) return;

        // Create & add new snapshot
        uint256 prevRPS = getLatestSnapshot().rewardPerShare;
        uint256 nextRPS = prevRPS.add(amount.mul(1e18).div(totalSupply);

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
}

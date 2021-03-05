// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface IVestedVaultBoardroom {
    struct BondingSnapshot {
        // Time when first bonding was made.
        uint256 firstBondedOn;
        // The snapshot index of when first bonded.
        uint256 snapshotIndexWhenFirstBonded;
    }

    struct Boardseat {
        // Pending reward from the previous epochs.
        uint256 rewardPending;
        // Total reward earned in this epoch.
        uint256 rewardEarnedCurrEpoch;
        // Last time reward was claimed(not bound by current epoch).
        uint256 lastClaimedOn;
        // The reward claimed in vesting period of this epoch.
        uint256 rewardClaimedCurrEpoch;
        // Snapshot of boardroom state when last epoch claimed.
        uint256 lastSnapshotIndex;
    }

    function updateReward(address who) external;

    function bondingHistory(address who)
        external
        view
        returns (BondingSnapshot memory);

    function directors(address who) external view returns (Boardseat memory);
}

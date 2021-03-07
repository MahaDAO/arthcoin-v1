// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import {IERC20} from '@openzeppelin/contracts/contracts/token/ERC20/IERC20.sol';
import {SafeMath} from '@openzeppelin/contracts/contracts/math/SafeMath.sol';
import {Vault} from './Vault.sol';
import {VaultBoardroom} from './VaultBoardroom.sol';
import {IBoardroom} from '../../interfaces/IBoardroom.sol';
import {IVault} from '../../interfaces/IVault.sol';

// import 'hardhat/console.sol';

contract VestedVaultBoardroom is VaultBoardroom {
    uint256 public vestFor;
    using SafeMath for uint256;

    struct VestedBondingSnapshot {
        // Time when first bonding was made.
        uint256 firstBondedOn;
        // The snapshot index of when first bonded.
        uint256 snapshotIndexWhenFirstBonded;
    }

    struct VestedBoardseat {
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

    /**
     * Event.
     */
    event VestingPeriodChanged(uint256 oldPeriod, uint256 period);

    /**
     * Constructor.
     */
    constructor(
        IERC20 token_,
        IVault vault_,
        uint256 vestFor_
    ) VaultBoardroom(token_, vault_) {
        vestFor = vestFor_;
    }

    /**
     * Views/Getters.
     */

    // given an amount and an epoch timestamp; returns what the vested amount would look like
    function getVestedAmount(uint256 amount, uint256 epochTimestamp)
        public
        view
        returns (uint256)
    {
        uint256 vestingEnd = epochTimestamp.add(vestFor);

        // console.log('getVestedAmount: b.time %s', block.timestamp);
        // console.log('getVestedAmount: epochTimestamp %s', epochTimestamp);
        // console.log('getVestedAmount: vestingEnd %s', vestingEnd);

        // see where we are in the current epoch and return vested amount
        // return the full amount
        if (block.timestamp > vestingEnd) return amount;

        // return a partial amount
        if (block.timestamp > epochTimestamp) {
            return
                amount
                    .mul(1e18)
                    .mul(block.timestamp.sub(epochTimestamp))
                    .div(vestFor)
                    .div(1e18);
        }

        return 0;
    }

    function getRewardsEarnedThisEpoch(address who)
        public
        view
        returns (uint256)
    {
        uint256 latestRPS = getLatestSnapshot().rewardPerShare;
        uint256 storedRPS =
            boardHistory[latestSnapshotIndex().sub(1)].rewardPerShare;

        // console.log('getRewardsEarnedThisEpoch latestRPS %s', latestRPS);
        // console.log('getRewardsEarnedThisEpoch storedRPS %s', storedRPS);
        // console.log('getLastEpochBalance val %s', getLastEpochBalance(who));

        return
            getBalanceFromLastEpoch(who).mul(latestRPS.sub(storedRPS)).div(
                1e18
            );
    }

    function getStartingRPSof(address who) public view returns (uint256) {
        return directors[who].firstRPS;
    }

    function getRewardsEarnedPrevEpoch(address who)
        public
        view
        returns (uint256)
    {
        if (latestSnapshotIndex() < 1) return 0;
        uint256 latestRPS =
            boardHistory[latestSnapshotIndex().sub(1)].rewardPerShare;
        uint256 startingRPS = getStartingRPSof(who);
        return
            getBalanceFromLastEpoch(who).mul(latestRPS.sub(startingRPS)).div(
                1e18
            );
    }

    function getClaimableRewards(address who) public view returns (uint256) {
        Boardseat memory seat = directors[who];
        uint256 latestFundingTime = boardHistory[boardHistory.length - 1].time;

        uint256 amtEarned = getRewardsEarnedThisEpoch(who);
        uint256 amtVested = getVestedAmount(amtEarned, latestFundingTime);
        uint256 amtPending = getRewardsEarnedPrevEpoch(who);

        // console.log(
        //     'getClaimableRewards: latestFundingTime %s',
        //     latestFundingTime
        // );
        // console.log('getClaimableRewards: amtEarned %s', amtEarned);
        // console.log('getClaimableRewards: amtVested %s', amtVested);
        // console.log('getClaimableRewards: amtPending %s', amtPending);
        // console.log('getClaimableRewards: claimed %s', seat.rewardClaimed);

        // console.log(
        //     'getClaimableRewards: token.balanceOf %s',
        //     token.balanceOf(address(this))
        // );

        return amtPending.add(amtVested).sub(seat.rewardClaimed);
    }

    function setVestFor(uint256 period) public onlyOwner {
        emit VestingPeriodChanged(vestFor, period);
        vestFor = period;
    }

    function claimReward() public override directorExists returns (uint256) {
        // console.log('claimReward called at: %s', block.timestamp);

        Boardseat storage seat = directors[msg.sender];

        uint256 reward = getClaimableRewards(msg.sender);
        if (reward == 0) return 0;

        seat.lastClaimedOn = block.timestamp;
        seat.rewardClaimed = seat.rewardClaimed.add(reward);
        token.transfer(msg.sender, reward);
        emit RewardPaid(msg.sender, reward);

        return reward;
    }

    // this fn is called by the vault
    function updateReward(address director) external override onlyVault {
        Boardseat storage seat = directors[director];

        // first time bonding; set firstRPS properly
        uint256 lastBondedEpoch = directorsLastEpoch[director];
        if (lastBondedEpoch == 0) {
            if (everyoneNewDirector || isOldDirector(director)) {
                seat.firstRPS = 0;
            } else {
                uint256 latestRPS = getLatestSnapshot().rewardPerShare;
                seat.firstRPS = latestRPS;
            }
        }

        // just update the user balance at this epoch
        BondingSnapshot memory snap =
            BondingSnapshot({
                epoch: currentEpoch,
                when: block.timestamp,
                valid: 1,
                balance: vault.balanceWithoutBonded(director)
            });

        // console.log(
        //     'vault updated balance %s',
        //     vault.balanceWithoutBonded(director)
        // );
        // console.log('vault updated epoch %s', currentEpoch);

        bondingHistory[director][currentEpoch] = snap;
        directorsLastEpoch[director] = currentEpoch;

        // claim rewards?

        // uint256 latestFundingTime = boardHistory[boardHistory.length - 1].time;
        seat.lastSnapshotIndex = latestSnapshotIndex();
    }

    function resinstateDirectorTo(
        address who,
        uint256 epoch,
        uint256 lastSnapshotIndex,
        uint256 rps
    ) public onlyOwner {
        directorsLastEpoch[who] = epoch;
        directors[who].lastSnapshotIndex = lastSnapshotIndex;
        directors[who].lastRPS = rps;
    }

    function resinstateDirectorsTo(
        address[] memory who,
        uint256 epoch,
        uint256 lastSnapshotIndex,
        uint256 rps
    ) public onlyOwner {
        for (uint256 i = 0; i < who.length; i++) {
            resinstateDirectorTo(who[i], epoch, lastSnapshotIndex, rps);
        }
    }
}

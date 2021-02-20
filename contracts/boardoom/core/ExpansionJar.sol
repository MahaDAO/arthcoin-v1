// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import '@openzeppelin/contracts/contracts/token/ERC20/SafeERC20.sol';
import {SafeMath} from '@openzeppelin/contracts/contracts/math/SafeMath.sol';
import {ERC20} from '@openzeppelin/contracts/contracts/token/ERC20/ERC20.sol';

import {Vault} from './Vault.sol';
import {Epoch} from '../../utils/Epoch.sol';
import {Operator} from '../../owner/Operator.sol';
import {VestedVaultBoardroom} from './VestedVaultBoardroom.sol';

contract ExpansionJar is Epoch, ERC20 {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    Vault vault;
    IERC20 token;
    VestedVaultBoardroom boardroom;

    uint256 compoundFor = 30 days;
    uint256 harvestAfter = 5 days;
    bool enableWithdrawal = false;
    uint256 public totalReward = 0;

    modifier stakerExists(address who) {
        require(balanceOf(who) > 0, 'Jar: the staker does not exist');

        _;
    }

    modifier canWithdraw {
        require(
            enableWithdrawal ||
                block.timestamp >= startTime.add(compoundFor).add(harvestAfter),
            'Jar: too early'
        );

        _;
    }

    constructor(
        IERC20 token_,
        Vault vault_,
        VestedVaultBoardroom boardroom_,
        uint256 startTime_,
        uint256 period_,
        uint256 startEpoch_
    ) ERC20('MahaDAO Jar LP', 'MJLP') Epoch(period_, startTime_, startEpoch_) {
        vault = vault_;
        token = token_;
        boardroom = boardroom_;
    }

    function setWithdrawal(bool val) public onlyOwner {
        enableWithdrawal = val;
    }

    function setCompoundFor(uint256 duration) public onlyOwner {
        compoundFor = duration;
    }

    function setHarvestAfter(uint256 duration) public onlyOwner {
        harvestAfter = duration;
    }

    function bond(uint256 amount) public checkStartTime {
        require(amount > 0, 'Jar: amount is 0');

        // Don't bond, if past compound period.
        if (block.timestamp >= startTime.add(compoundFor)) return;

        token.safeTransferFrom(msg.sender, address(this), amount);
        token.safeApprove(address(vault), amount);

        vault.bond(amount);
    }

    function unbond() public checkStartTime {
        // Don't unbond, if still in compound period.
        if (block.timestamp < startTime.add(compoundFor)) return;

        // Claim the rewards and don't reinvest.
        // It's necessary to claim before unbonding, as per the boardroom's design.
        uint256 rewards = boardroom.claimReward();
        uint256 balance = vault.balanceOf(address(this));

        vault.unbond(balance);

        // Just a safety check, to validate that we are unbonding the entire amount.
        assert(vault.balanceWithoutBonded(address(this)) == 0);

        // Since this is the balance, that we have after compouding for compouding duration.
        // Hence this also has the principal amount, which we subtract to get only epochly
        // reward which we would have claimed.
        // We also add, the fresh rewards we have generated(which we didn't reinvest).
        totalReward = totalReward.add(balance).add(rewards).sub(totalSupply());
    }

    function harvest() public checkStartTime {
        // Don't harvest, if we are still in compounding period.
        if (block.timestamp < startTime.add(compoundFor)) return;

        // If we are after the harvest period, then enable withdrawals.
        if (block.timestamp >= startTime.add(compoundFor).add(harvestAfter))
            enableWithdrawal = true;

        // Will revert, if unbonding duration of vault is not satisfied.
        vault.withdraw();

        // HERE we don't calcualte the reward once again as the boardroom
        // considers balance that is still bonded. However we unbond only once with full balance
        // after the compound period, hence the balance of still bonded would be 0.

        // TODO: check if we have any maha reward, if we have then sell that MAHA for ARTH.
    }

    function claimAndReinvest() public onlyOwner checkEpoch checkStartTime {
        // If we are above the harvesting and compouding period, then enable withdrawals.
        // Check epoch reverts if false == callable();
        if (block.timestamp >= startTime.add(compoundFor).add(harvestAfter)) {
            enableWithdrawal = true;

            return;
        }

        // boardroom.claimAndReinvestReward();  // Problem with this is that, vault would have to approve to bond again.

        uint256 reward = boardroom.claimReward();
        token.safeApprove(address(vault), reward);

        vault.bond(reward);
    }

    function withdraw()
        public
        stakerExists(msg.sender)
        canWithdraw
    // checkStartTime // Redundant as canWithdraw handles time and also whether we are allowed.
    {
        uint256 balance = balanceOf(msg.sender);
        uint256 contributionInPool =
            balance.mul(100).mul(1e18).div(totalSupply());

        // Burn, equivalent amount of jar lp tokens.
        _burn(msg.sender, balance);

        uint256 amountToReward =
            totalReward.mul(contributionInPool).div(100).div(1e18);

        token.transfer(msg.sender, amountToReward);

        totalReward = totalReward.sub(amountToReward);
    }
}

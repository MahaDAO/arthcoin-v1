// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import {SafeMath} from '@openzeppelin/contracts/contracts/math/SafeMath.sol';
import {IERC20} from '@openzeppelin/contracts/contracts/token/ERC20/IERC20.sol';

import {Vault} from './Vault.sol';
import {Epoch} from '../../utils/Epoch.sol';
import {Operator} from '../../owner/Operator.sol';
import {VestedVaultBoardroom} from './VestedVaultBoardroom.sol';

contract ExpansionJar is Epoch {
    using SafeMath for uint256;

    Vault vault;
    IERC20 token;
    VestedVaultBoardroom boardroom;

    uint256 public totalReward;
    uint256 internal _totalSupply;
    uint256 compoundFor = 30 days;
    uint256 harvestAfter = 5 days;
    bool enableWithdrawal = false;
    uint256 public totalAmountThatWasStaked;

    mapping(address => uint256) internal _balances;

    modifier stakerExists(address who) {
        require(balanceOf(who) > 0, 'Boardroom: The director does not exist');

        _;
    }

    constructor(
        IERC20 token_,
        Vault vault_,
        VestedVaultBoardroom boardroom_,
        uint256 _startTime,
        uint256 _period,
        uint256 _startEpoch
    ) Epoch(_period, _startTime, _startEpoch) {
        vault = vault_;
        token = token_;
        boardroom = boardroom_;
    }

    function totalSupply() public view returns (uint256) {
        return _totalSupply;
    }

    function balanceOf(address who) public view returns (uint256) {
        return _balances[who];
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

        vault.bond(amount);

        _totalSupply = _totalSupply.add(amount);
        _balances[msg.sender] = _balances[msg.sender].add(amount);
    }

    function unbond() public onlyOwner checkStartTime {
        if (block.timestamp >= startTime.add(compoundFor)) {
            uint256 balance = vault.balanceOf(address(this));

            vault.unbond(balance);

            // Since this is the balance, that we have after compouding for compouding duration.
            // Hence this also has the principal amount, which we subtract to get only epochly
            // reward which we would have claimed.
            totalReward = totalReward.add(balance).sub(_totalSupply);
        }
    }

    function harvest() public onlyOwner checkStartTime {
        if (block.timestamp >= startTime.add(compoundFor).add(harvestAfter))
            enableWithdrawal = true;

        vault.withdraw();

        // HERE we don't calcualte the reward once again as the boardroom
        // considers balance that is still bonded. However we unbond only once with full balance
        // after the compound period, hence the balance of still bonded would be 0.
    }

    function claimAndReinvest() public onlyOwner checkEpoch checkStartTime {
        boardroom.claimAndReinvestReward();

        if (block.timestamp >= startTime.add(compoundFor).add(harvestAfter))
            enableWithdrawal = true;
    }

    function withdraw() public stakerExists(msg.sender) checkStartTime {
        require(enableWithdrawal, 'Jar: too early');

        uint256 amount = _balances[msg.sender];
        uint256 percentOfStake =
            amount.mul(100).mul(1e18).div(totalAmountThatWasStaked);

        uint256 amountToReward =
            totalReward.mul(percentOfStake).div(100).div(1e18);

        _balances[msg.sender] = 0;
        _totalSupply = _totalSupply.sub(amount);

        token.transfer(msg.sender, amountToReward);
    }
}

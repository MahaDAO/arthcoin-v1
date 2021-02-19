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

    uint256 compoundFor = 30 days;
    uint256 harvestAfter = 5 days;

    bool enableWithdrawal = false;

    uint256 internal _totalSupply;
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

    function claimAndReinvest() public onlyOwner checkEpoch checkStartTime {
        if (getCurrentEpoch() >= getNextEpoch() && getNextEpoch() > 0)
            boardroom.claimAndReinvestReward();

        if (block.timestamp >= startTime.add(compoundFor).add(harvestAfter))
            enableWithdrawal = true;
    }

    function withdraw() public stakerExists(msg.sender) checkStartTime {
        require(enableWithdrawal, 'Jar: too early');

        uint256 amount = _balances[msg.sender];

        _balances[msg.sender] = 0;
        _totalSupply = _totalSupply.sub(amount);

        token.transfer(msg.sender, amount);
    }
}

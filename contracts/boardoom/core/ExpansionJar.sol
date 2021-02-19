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

    uint256 startTime;
    uint256 harvestingDuration = 30 days;
    uint256 compoundingDuration = 5 days;

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
    ) public Epoch(_period, _startTime, _startEpoch) {
        vault = vault_;
        token = token_;
        boardroom = boardroom_;

        startTime = block.timestamp;
    }

    function totalSupply() public view returns (uint256) {
        return _totalSupply;
    }

    function balanceOf(address who) public view returns (uint256) {
        return _balances[who];
    }

    function bond(uint256 amount) public checkStartTime {
        require(amount > 0, 'Jar: amount = 0');

        vault.bond(amount);

        _totalSupply = _totalSupply.add(amount);
        _balances[msg.sender] = _balances[msg.sender].add(amount);
    }

    function claimAndReinvest() public onlyOwner checkEpoch {
        if (getCurrentEpoch() >= getNextEpoch() && getNextEpoch() > 0)
            boardroom.claimAndReinvestReward();

        if (
            block.timestamp >=
            startTime.add(compoundingDuration).add(harvestingDuration)
        ) enableWithdrawal = true;
    }

    function withdraw() public stakerExists(msg.sender) checkStartTime {
        require(enableWithdrawal, 'Jar: too early');

        uint256 directorShare = _balances[msg.sender];
        uint256 amount = getStakedAmount(msg.sender);

        require(
            directorShare >= amount,
            'Jar: withdraw request greater than unbonded amount'
        );

        _totalSupply = _totalSupply.sub(amount);
        _balances[msg.sender] = directorShare.sub(amount);
        token.transfer(msg.sender, amount);

        _updateStakerDetails(msg.sender, block.timestamp, 0);
    }
}

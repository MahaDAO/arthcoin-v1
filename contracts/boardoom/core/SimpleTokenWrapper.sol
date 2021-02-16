// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import {SafeMath} from '@openzeppelin/contracts/contracts/math/SafeMath.sol';
import {IERC20} from '@openzeppelin/contracts/contracts/token/ERC20/IERC20.sol';
import '../../owner/Operator.sol';
import '../../owner/Router.sol';

import {BaseBoardroom} from './BaseBoardroom.sol';

abstract contract SimpleTokenWrapper is BaseBoardroom {
    using SafeMath for uint256;

    function stake(uint256 amount) public virtual depositsEnabled {
        _updateStakerDetails(msg.sender, block.timestamp, amount);

        _totalSupply += amount;
        _balances[msg.sender] = _balances[msg.sender].add(amount);
        share.transferFrom(msg.sender, address(this), amount);
    }

    function withdraw(uint256 amount) public virtual checkLockDuration {
        uint256 directorShare = _balances[msg.sender];

        require(
            directorShare >= amount,
            'Boardroom: withdraw request greater than staked amount'
        );

        _totalSupply = _totalSupply.sub(amount);
        _balances[msg.sender] = directorShare.sub(amount);
        share.transfer(msg.sender, amount);
    }
}

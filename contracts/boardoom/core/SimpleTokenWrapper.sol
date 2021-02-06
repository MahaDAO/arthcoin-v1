// SPDX-License-Identifier: MIT

pragma solidity ^0.6.12;
// pragma experimental ABIEncoderV2;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';

import '../../owner/Operator.sol';
import '../../owner/Router.sol';
import './BaseBoardroom.sol';

abstract contract SimpleTokenWrapper is BaseBoardroom {
    function stake(uint256 amount) public virtual depositsEnabled {
        _updateStakerDetails(msg.sender, block.timestamp, amount);

        _totalSupply = _totalSupply.add(amount);
        _balances[msg.sender] = _balances[msg.sender].add(amount);
        share.safeTransferFrom(msg.sender, address(this), amount);
    }

    function withdraw(uint256 amount) public virtual checkLockDuration {
        uint256 directorShare = _balances[msg.sender];

        require(
            directorShare >= amount,
            'Boardroom: withdraw request greater than staked amount'
        );

        _totalSupply = _totalSupply.sub(amount);
        _balances[msg.sender] = directorShare.sub(amount);
        share.safeTransfer(msg.sender, amount);
    }
}

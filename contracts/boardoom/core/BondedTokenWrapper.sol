// SPDX-License-Identifier: MIT

pragma solidity ^0.6.12;
// pragma experimental ABIEncoderV2;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';
import './BaseBoardroom.sol';

abstract contract BondedTokenWrapper is BaseBoardroom {
    function bond(uint256 amount) public virtual depositsEnabled {
        _totalSupply = _totalSupply.add(amount);
        _balances[msg.sender] = _balances[msg.sender].add(amount);
        share.safeTransferFrom(msg.sender, address(this), amount);
    }

    function unbond(uint256 amount) public virtual {
        uint256 directorShare = _balances[msg.sender];

        require(
            directorShare >= amount,
            'Boardroom: unbond request greater than staked amount'
        );

        _updateStakerDetails(msg.sender, block.timestamp, amount);
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

// SPDX-License-Identifier: MIT

pragma solidity ^0.6.12;
// pragma experimental ABIEncoderV2;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';
import './BaseBoardroom.sol';

abstract contract BondedTokenWrapper is BaseBoardroom {
    function balanceWithoutBonded(address account)
        public
        view
        returns (uint256)
    {
        uint256 amount = getStakedAmount(msg.sender);
        return _balances[account].sub(amount);
    }

    function _bond(uint256 amount) internal virtual depositsEnabled {
        require(amount > 0, 'Boardroom: Cannot stake 0');

        _totalSupply = _totalSupply.add(amount);
        _balances[msg.sender] = _balances[msg.sender].add(amount);
        share.safeTransferFrom(msg.sender, address(this), amount);

        emit Bonded(msg.sender, amount);
    }

    function _unbond(uint256 amount) internal virtual {
        require(amount > 0, 'Boardroom: Cannot unbond 0');

        uint256 directorShare = _balances[msg.sender];

        require(
            directorShare >= amount,
            'Boardroom: unbond request greater than staked amount'
        );

        _updateStakerDetails(msg.sender, block.timestamp, amount);

        emit Unbonded(msg.sender, amount);
    }

    function _withdraw() internal checkLockDuration {
        uint256 directorShare = _balances[msg.sender];
        uint256 amount = getStakedAmount(msg.sender);

        require(
            directorShare >= amount,
            'Boardroom: withdraw request greater than unbonded amount'
        );

        _totalSupply = _totalSupply.sub(amount);
        _balances[msg.sender] = directorShare.sub(amount);
        share.safeTransfer(msg.sender, amount);

        _updateStakerDetails(msg.sender, block.timestamp, 0);

        emit Withdrawn(msg.sender, amount);
    }

    event Bonded(address indexed user, uint256 amount);
    event Unbonded(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
}

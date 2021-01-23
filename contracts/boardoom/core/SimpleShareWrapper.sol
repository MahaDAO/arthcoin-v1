// SPDX-License-Identifier: MIT

pragma solidity ^0.6.12;
// pragma experimental ABIEncoderV2;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';

import '../../owner/Operator.sol';
import '../../timelock/StakingTimelock.sol';

abstract contract SimpleShareWrapper is StakingTimelock, Operator {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    IERC20 public share;

    uint256 private _totalSupply;
    mapping(address => uint256) private _balances;

    function totalSupply() public view returns (uint256) {
        return _totalSupply;
    }

    function balanceOf(address account) public view returns (uint256) {
        return _balances[account];
    }

    function _addStakerDetails(address sender, uint256 _amount) private {
        StakingDetails storage _stakerDetails = _stakingDetails[sender];

        _stakerDetails.lastStakedOn = block.timestamp;
        _stakerDetails.lastStakedAmount = _amount;
        _stakerDetails.totalStakedAmount = _stakerDetails.totalStakedAmount.add(
            _amount
        );
    }

    function stake(uint256 amount) public virtual {
        _addStakerDetails(msg.sender, amount);

        _totalSupply = _totalSupply.add(amount);
        _balances[msg.sender] = _balances[msg.sender].add(amount);
        share.safeTransferFrom(msg.sender, address(this), amount);
    }

    function stakeFor(address onBehalf, uint256 amount)
        public
        virtual
        onlyOperator
    {
        _addStakerDetails(onBehalf, amount);

        _totalSupply = _totalSupply.add(amount);
        _balances[msg.sender] = _balances[onBehalf].add(amount);
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

// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
// pragma experimental ABIEncoderV2;

import {IERC20} from '@openzeppelin/contracts/contracts/token/ERC20/IERC20.sol';
import '../../owner/Operator.sol';
import '../../owner/Router.sol';
import '../../timelock/StakingTimelock.sol';

abstract contract BaseBoardroom is StakingTimelock, Router, Operator {
    using SafeMath for uint256;

    IERC20 public share;

    bool public enableDeposits = true;
    uint256 internal _totalSupply;
    mapping(address => uint256) internal _balances;

    modifier depositsEnabled() {
        require(enableDeposits, 'boardroom: deposits are disabled');
        _;
    }

    function totalSupply() public view returns (uint256) {
        return _totalSupply;
    }

    function balanceOf(address account) public view returns (uint256) {
        return _balances[account];
    }

    function toggleDeposits(bool val) external onlyOwner {
        enableDeposits = val;
    }

    function refund() external onlyOwner {
        share.transfer(msg.sender, share.balanceOf(address(this)));
    }
}

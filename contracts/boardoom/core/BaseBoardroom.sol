// SPDX-License-Identifier: MIT

pragma solidity ^0.6.12;
// pragma experimental ABIEncoderV2;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';

import '../../owner/Operator.sol';
import '../../owner/Router.sol';
import '../../timelock/StakingTimelock.sol';
import '../../interfaces/IBoardroom.sol';

abstract contract BaseBoardroom is
    StakingTimelock,
    Router,
    Operator,
    IBoardroom
{
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

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
}

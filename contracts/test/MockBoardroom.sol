// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {SafeERC20} from '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';

import {Operator} from '../owner/Operator.sol';
import {IBoardroom} from '../interfaces/IBoardroom.sol';

contract MockBoardroom is IBoardroom, Operator {
    using SafeERC20 for IERC20;

    /* ========== STATE VARIABLES ========== */

    IERC20 public cash;

    /* ========== CONSTRUCTOR ========== */

    constructor(address _cash) public {
        cash = IERC20(_cash);
    }

    /* ========== MUTATIVE FUNCTIONS ========== */

    function allocateSeigniorage(uint256 amount)
        external
        override
        onlyOperator
    {
        require(amount > 0, 'Boardroom: Cannot allocate 0');
        cash.safeTransferFrom(msg.sender, address(this), amount);
        emit RewardAdded(msg.sender, amount);
    }

    /* ========== EVENTS ========== */

    event RewardAdded(address indexed user, uint256 reward);
}

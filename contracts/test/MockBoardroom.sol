// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import {IERC20} from '@openzeppelin/contracts/contracts/token/ERC20/IERC20.sol';
import {Operator} from '../owner/Operator.sol';
import {IBoardroom} from '../interfaces/IBoardroom.sol';

contract MockBoardroom is IBoardroom, Operator {
    /* ========== STATE VARIABLES ========== */

    IERC20 public cash;
    mapping(address => Boardseat) public directors;

    /* ========== CONSTRUCTOR ========== */

    constructor(address _cash) {
        cash = IERC20(_cash);
    }

    /* ========== MUTATIVE FUNCTIONS ========== */

    function allocateSeigniorage(uint256 amount)
        external
        override
        onlyOperator
    {
        require(amount > 0, 'Boardroom: Cannot allocate 0');
        cash.transferFrom(msg.sender, address(this), amount);
        emit RewardAdded(msg.sender, amount);
    }

    /* ========== EVENTS ========== */

    function getDirector(address who)
        external
        view
        override
        returns (Boardseat memory)
    {
        return directors[who];
    }

    function getLastSnapshotIndexOf(address director)
        external
        view
        override
        returns (uint256)
    {
        return 0;
    }

    event RewardAdded(address indexed user, uint256 reward);
}

// SPDX-License-Identifier: MIT

pragma solidity ^0.6.12;

import {IOperator} from './IOperator.sol';

interface IBoardroom is IOperator {
    function allocateSeigniorage(uint256 amount) external;
}

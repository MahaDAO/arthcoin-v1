// SPDX-License-Identifier: MIT

pragma solidity ^0.6.12;

import {IEpoch} from './IEpoch.sol';

interface IOperator {
    function operator() external view returns (address);

    function isOperator() external view returns (bool);

    function transferOperator(address newOperator_) external;
}

// SPDX-License-Identifier: MIT

pragma solidity ^0.6.0;
import './IOracle.sol';

interface IMultiUniswapOracle is IOracle {
    function update() external;
}
// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import './ISimpleOracle.sol';

interface IMultiUniswapOracle is ISimpleOracle {
    function update() external;
}

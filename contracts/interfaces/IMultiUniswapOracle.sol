// SPDX-License-Identifier: MIT

pragma solidity ^0.6.12;

import './ISimpleOracle.sol';

interface IMultiUniswapOracle is ISimpleOracle {
    function update() external;
}

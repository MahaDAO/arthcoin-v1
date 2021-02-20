// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import {UniswapOracle} from './core/UniswapOracle.sol';
import {IUniswapV2Pair} from '../interfaces/IUniswapV2Pair.sol';

// Fixed window oracle that recomputes the average price for the entire period once every period
// note that the price average is only guaranteed to be over at least 1 period, but may be over a
// longer period.
contract TWAP1hrOracle is UniswapOracle {
    constructor(
        IUniswapV2Pair _pair,
        uint256 _period,
        uint256 _startTime
    ) UniswapOracle(_pair, _period, _startTime) {}
}

// SPDX-License-Identifier: MIT

pragma solidity ^0.6.0;

import './core/MultiUniswapOracle.sol';

// Fixed window oracle that recomputes the average price for the entire period once every period
// note that the price average is only guaranteed to be over at least 1 period, but may be over a
// longer period.
contract BondRedemtionOracle is MultiUniswapOracle {
    constructor(
        address _factory,
        address _cash,
        address _dai,
        uint256 _period,
        uint256 _startTime
    )
        public
        MultiUniswapOracle(
            _factory,
            _cash,
            _dai,
            address(0),
            address(0),
            2,
            _period,
            _startTime
        )
    {}
}

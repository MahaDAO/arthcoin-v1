// SPDX-License-Identifier: MIT

pragma solidity ^0.6.0;

import './core/MultiUniswapOracle.sol';

contract ArthMahaTestnetOracle is MultiUniswapOracle {
    constructor(
        address _router,
        address _arth,
        address _dai,
        address _maha,
        uint256 _period,
        uint256 _startTime
    )
        public
        MultiUniswapOracle(
            _router,
            _arth,
            _dai,
            _maha,
            address(0),
            3,
            _period,
            _startTime
        )
    {}
}

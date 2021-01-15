// SPDX-License-Identifier: MIT

pragma solidity ^0.6.0;

import './core/MultiUniswapOracle.sol';

contract MahaArthOracle is MultiUniswapOracle {
    constructor(
        address _router,
        address _maha,
        address _weth,
        address _dai,
        address _arth,
        uint256 _period,
        uint256 _startTime
    )
        public
        MultiUniswapOracle(
            _router,
            _maha,
            _weth,
            _dai,
            _arth,
            4,
            _period,
            _startTime
        )
    {}
}

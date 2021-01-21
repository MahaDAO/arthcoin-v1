// SPDX-License-Identifier: MIT

pragma solidity ^0.6.12;

import './core/MultiUniswapOracle.sol';

contract ArthMahaOracle is MultiUniswapOracle {
    constructor(
        address _router,
        address _arth,
        address _dai,
        address _weth,
        address _maha,
        uint256 _period,
        uint256 _startTime
    )
        public
        MultiUniswapOracle(
            _router,
            _arth,
            _dai,
            _weth,
            _maha,
            4,
            _period,
            _startTime
        )
    {}
}

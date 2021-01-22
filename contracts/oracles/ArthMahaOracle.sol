// SPDX-License-Identifier: MIT

pragma solidity ^0.6.12;

import './core/SimpleOracle.sol';

contract ArthMahaOracle is SimpleOracle {
    constructor(
        address _router,
        address _arth,
        address _dai,
        address _weth,
        address _maha,
        uint256 _period,
        uint256 _startTime
    ) public SimpleOracle('ArthMahaOracle', 1e18) {}
}

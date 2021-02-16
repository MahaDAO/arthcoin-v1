// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import './core/SimpleOracle.sol';

contract ArthMahaTestnetOracle is SimpleOracle {
    constructor(
        address _router,
        address _arth,
        address _dai,
        address _maha,
        uint256 _period,
        uint256 _startTime
    ) public SimpleOracle('ARTHMahaOracle', 1e18) {}
}

// SPDX-License-Identifier: MIT

pragma solidity ^0.6.0;

import './core/ARTHTOKENPool.sol';

contract ARTHMahaPool is ARTHTokenPool {
    constructor(
        address token0_,
        address token1_,
        uint256 starttime_
    ) public ARTHTokenPool(token0_, token1_, starttime_) {}
}

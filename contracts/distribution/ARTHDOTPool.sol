// SPDX-License-Identifier: MIT

pragma solidity ^0.6.0;

import './ARTHTOKENPool.sol';

contract ARTHDOTPool is ARTHTOKENPool {
    constructor(
        address token0_,
        address token1_,
        uint256 starttime_,
        uint256 duration_
    ) public ARTHTOKENPool(token0_, token1_, starttime_, duration_) {}
}

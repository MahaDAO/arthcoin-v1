// SPDX-License-Identifier: MIT

pragma solidity ^0.6.0;

import './ARTHTOKENPool.sol';

contract ARTHHTPool is ARTHTOKENPool {
    constructor(
        address token0_,
        address token1_,
        uint256 starttime_
    ) public ARTHTOKENPool(token0_, token1_, starttime_) {}
}

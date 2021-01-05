// SPDX-License-Identifier: MIT

pragma solidity ^0.6.0;

import './Pool.sol';

contract BACSUSDPool is BACTokenPool {
    constructor(
        address token0_,
        address token1_,
        uint256 starttime_
    ) public BACTokenPool(token0_, token1_, starttime_) {}
}

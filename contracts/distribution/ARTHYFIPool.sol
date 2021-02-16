// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import './core/ARTHTOKENPool.sol';

contract ARTHFYIPool is ARTHTOKENPool {
    constructor(
        address cash_,
        address dai_,
        uint256 starttime_,
        uint256 maxPoolSize_
    )
        public
        ARTHTOKENPool(
            cash_,
            dai_,
            starttime_,
            maxPoolSize_,
            true,
            'ARTHFYIPool'
        )
    {}
}

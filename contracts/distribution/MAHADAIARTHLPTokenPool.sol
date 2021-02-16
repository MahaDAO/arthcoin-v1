// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import './core/ARTHTOKENPool.sol';

contract MAHADAIARTHLPTokenPool is ARTHTOKENPool {
    constructor(
        address cash_,
        address dai_,
        uint256 starttime_
    )
        public
        ARTHTOKENPool(
            cash_,
            dai_,
            starttime_,
            0,
            false,
            'MAHADAIARTHLPTokenPool'
        )
    {}
}

// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import './core/ARTHTOKENPool.sol';

contract MAHAMAHAETHLPTokenPool is ARTHTOKENPool {
    constructor(
        address cash_,
        address dai_,
        uint256 starttime_
    )
        ARTHTOKENPool(
            cash_,
            dai_,
            starttime_,
            0,
            false,
            'MAHAMAHAETHLPTokenPool'
        )
    {}
}

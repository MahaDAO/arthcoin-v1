// SPDX-License-Identifier: MIT

pragma solidity ^0.6.0;

import './core/ARTHTOKENPool.sol';

contract MAHAARTHPool is ARTHTOKENPool {
    constructor(
        address cash_,
        address dai_,
        uint256 starttime_
    ) public ARTHTOKENPool(cash_, dai_, starttime_, 0, false, 'MAHAARTHPool') {}
}

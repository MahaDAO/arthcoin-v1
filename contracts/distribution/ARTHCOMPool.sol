// SPDX-License-Identifier: MIT

pragma solidity ^0.6.0;

import './ARTHTOKENPool.sol';

contract ARTHCOMPPool is ARTHTOKENPool {
    constructor(
        address cash_,
        address dai_,
        uint256 starttime_,
        uint256 maxPoolSize_,
        bool limitPoolSize_,
        string memory poolName_
    )
        public
        ARTHTOKENPool(
            cash_,
            dai_,
            starttime_,
            maxPoolSize_,
            limitPoolSize_,
            'ARTHCOMPPool'
        )
    {}
}
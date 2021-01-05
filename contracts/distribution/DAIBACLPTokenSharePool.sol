// SPDX-License-Identifier: MIT

pragma solidity ^0.6.0;

import './DAITOKENLPTokenSharePool.sol';

contract DAIBACLPTokenSharePool is DAIASSETLPTokenSharePool {
    constructor(
        address assetShare_,
        address lpToken_,
        uint256 starttime_
    ) public DAIASSETLPTokenSharePool(assetShare_, lpToken_, starttime_) {}
}

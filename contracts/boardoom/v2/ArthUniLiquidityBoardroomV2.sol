// SPDX-License-Identifier: MIT

pragma solidity ^0.6.12;

import '../core/VestedBondedBoardroom.sol';

contract ArthUniLiquidityBoardroomV2 is VestedBondedBoardroom {
    constructor(
        IERC20 _cash,
        IERC20 _share,
        uint256 _duration,
        uint256 _vestFor
    ) public VestedBondedBoardroom(_cash, _share, _duration, _vestFor) {}
}

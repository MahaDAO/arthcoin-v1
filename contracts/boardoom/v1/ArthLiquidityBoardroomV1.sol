// SPDX-License-Identifier: MIT

pragma solidity ^0.6.12;

import '../core/SimpleBoardroom.sol';

contract ArthLiquidityBoardroomV1 is SimpleBoardroom {
    constructor(
        IERC20 _cash,
        IERC20 _share,
        uint256 _duration
    ) public SimpleBoardroom(_cash, _share, _duration) {}
}

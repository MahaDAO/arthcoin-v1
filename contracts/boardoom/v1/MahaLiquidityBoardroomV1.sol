// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import '../core/SimpleBoardroom.sol';

contract MahaLiquidityBoardroomV1 is SimpleBoardroom {
    constructor(
        IERC20 _cash,
        IERC20 _share,
        uint256 _duration
    ) SimpleBoardroom(_cash, _share, _duration) {}
}

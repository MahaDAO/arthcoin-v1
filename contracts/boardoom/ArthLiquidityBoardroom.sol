// SPDX-License-Identifier: MIT

pragma solidity ^0.6.12;

import './core/VestedBondedBoardroom.sol';

contract ArthLiquidityBoardroom is VestedBondedBoardroom {
    constructor(
        IERC20 _cash,
        IERC20 _share,
        uint256 _duration
    ) public VestedBondedBoardroom(_cash, _share, _duration) {}
}

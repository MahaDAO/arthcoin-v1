// SPDX-License-Identifier: MIT

pragma solidity ^0.6.0;

import './Boardroom.sol';

contract ArthLiquidityBoardroom is Boardroom {
    constructor(IERC20 _cash, IERC20 _share) public Boardroom(_cash, _share) {}
}

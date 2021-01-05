// SPDX-License-Identifier: MIT

pragma solidity ^0.6.0;

import './Boardroom.sol';

contract ArthBoardroom is Boardroom {
    constructor(IERC20 _cash) public Boardroom(_cash, _cash) {}
}

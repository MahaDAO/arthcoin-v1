// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import '../core/SimpleBoardroom.sol';

contract ArthBoardroomV1 is SimpleBoardroom {
    constructor(IERC20 _cash, uint256 _duration)
        public
        SimpleBoardroom(_cash, _cash, _duration)
    {}
}

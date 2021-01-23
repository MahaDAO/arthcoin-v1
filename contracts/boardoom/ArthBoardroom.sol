// SPDX-License-Identifier: MIT

pragma solidity ^0.6.12;

import './core/SimpleBoardroom.sol';

contract ArthBoardroom is SimpleBoardroom {
    constructor(IERC20 _cash, uint256 _duration)
        public
        SimpleBoardroom(_cash, _cash, _duration)
    {}
}

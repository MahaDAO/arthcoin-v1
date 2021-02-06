// SPDX-License-Identifier: MIT

pragma solidity ^0.6.12;

import './core/VestedBondedBoardroom.sol';

contract ArthBoardroom is VestedBondedBoardroom {
    constructor(IERC20 _cash, uint256 _duration)
        public
        VestedBondedBoardroom(_cash, _cash, _duration)
    {}
}

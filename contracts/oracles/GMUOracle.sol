// SPDX-License-Identifier: MIT

pragma solidity ^0.6.12;

import './core/SimpleOracle.sol';

contract GMUOracle is SimpleOracle {
    constructor(uint256 _price) public SimpleOracle('GMU Oracle', _price) {}
}

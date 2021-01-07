// SPDX-License-Identifier: MIT

pragma solidity ^0.6.0;

import './Oracle.sol';

contract MAHAUSDOracle is Oracle {
    constructor(string memory _name) public Oracle(_name) {}
}

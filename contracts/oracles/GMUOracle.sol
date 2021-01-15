// SPDX-License-Identifier: MIT

pragma solidity ^0.6.0;

import './core/SimpleOracle.sol';

contract GMUOracle is SimpleOracle {
    constructor(string memory _name, uint256 _price)
        public
        SimpleOracle(_name, _price)
    {}
}

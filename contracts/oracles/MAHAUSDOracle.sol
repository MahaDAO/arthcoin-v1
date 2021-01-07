// SPDX-License-Identifier: MIT

pragma solidity ^0.6.0;

import './Oracle.sol';

contract MAHAUSDOracle is Oracle {
    constructor(string memory _name, uint256 _price)
        public
        Oracle(_name, _price)
    {}
}

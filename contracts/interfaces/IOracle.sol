// SPDX-License-Identifier: MIT

pragma solidity ^0.6.0;

interface IOracle {
    function getPrice() external view returns (uint256);
}

// SPDX-License-Identifier: MIT

pragma solidity ^0.6.0;

interface IGMUOracle {
    function setPrice(uint256 _price) external;

    function getPrice() external view returns (uint256);

    function consult(uint256 amountIn)
        external
        view
        returns (uint256 amountOut);
}

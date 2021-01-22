// SPDX-License-Identifier: MIT

pragma solidity ^0.6.12;

import '@openzeppelin/contracts/math/SafeMath.sol';

import '../interfaces/ISimpleOracle.sol';
import '../lib/UniswapV2Library.sol';

contract MockSimpleOracle is ISimpleOracle {
    using SafeMath for uint256;

    uint256 epoch;
    uint256 period = 1;

    uint256 public price = 1e18;
    bool public error;

    uint256 startTime;

    constructor() public {
        startTime = block.timestamp;
    }

    // epoch
    function callable() public pure returns (bool) {
        return true;
    }

    function setPrice(uint256 _price) public {
        price = _price;
    }

    function setRevert(bool _error) public {
        error = _error;
    }

    function getPrice() external view override returns (uint256) {
        return price;
    }

    function consult(uint256 amountIn)
        external
        view
        override
        returns (uint256)
    {
        return price.mul(amountIn).div(1e18);
    }

    event Updated(uint256 price0CumulativeLast, uint256 price1CumulativeLast);
}

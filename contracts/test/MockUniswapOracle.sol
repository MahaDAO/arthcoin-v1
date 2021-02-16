// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import {SafeMath} from '@openzeppelin/contracts/contracts/math/SafeMath.sol';

import {IUniswapOracle} from '../interfaces/IUniswapOracle.sol';
import {UniswapV2Library} from '../lib/UniswapV2Library.sol';

contract MockUniswapOracle is IUniswapOracle {
    using SafeMath for uint256;

    uint256 epoch;
    uint256 period = 1;

    uint256 public price = 1e18;
    bool public error;

    uint256 startTime;

    constructor() {
        startTime = block.timestamp;
    }

    // epoch
    function callable() public view override returns (bool) {
        return true;
    }

    function setEpoch(uint256 _epoch) public {
        epoch = _epoch;
    }

    function setStartTime(uint256 _startTime) public {
        startTime = _startTime;
    }

    function setPeriod(uint256 _period) public override {
        period = _period;
    }

    function getLastEpoch() public view override returns (uint256) {
        return epoch;
    }

    function getCurrentEpoch() public view override returns (uint256) {
        return epoch;
    }

    function getNextEpoch() public view override returns (uint256) {
        return epoch.add(1);
    }

    function nextEpochPoint() public view override returns (uint256) {
        return startTime.add(getNextEpoch().mul(period));
    }

    // params
    function getPeriod() public view override returns (uint256) {
        return period;
    }

    function getStartTime() public view override returns (uint256) {
        return startTime;
    }

    function setPrice(uint256 _price) public {
        price = _price;
    }

    function getPrice() external view returns (uint256) {
        return price;
    }

    function setRevert(bool _error) public {
        error = _error;
    }

    function update() external override {
        require(!error, 'Oracle: mocked error');
        emit Updated(0, 0);
    }

    function consult(address, uint256 amountIn)
        external
        view
        override
        returns (uint256)
    {
        return price.mul(amountIn).div(1e18);
    }

    function pairFor(
        address factory,
        address tokenA,
        address tokenB
    ) external pure returns (address lpt) {
        return UniswapV2Library.pairFor(factory, tokenA, tokenB);
    }

    event Updated(uint256 price0CumulativeLast, uint256 price1CumulativeLast);
}

// SPDX-License-Identifier: MIT

pragma solidity ^0.6.12;

import '@openzeppelin/contracts/math/SafeMath.sol';

import '../lib/Babylonian.sol';
import '../lib/FixedPoint.sol';
import '../owner/Operator.sol';

contract MockUniswapOracle is Operator {
    using FixedPoint for *;
    using SafeMath for uint256;

    address public token0;
    address public token1;

    uint256 public price0CumulativeLast;
    uint256 public price1CumulativeLast;
    FixedPoint.uq112x112 public price0Average;
    FixedPoint.uq112x112 public price1Average;

    constructor(
        address _tokenA,
        address _tokenB,
        uint256 _initialPriceA,
        uint256 _initialPriceB
    ) public {
        token0 = _tokenA;
        token1 = _tokenB;
        price0CumulativeLast = _initialPriceA;
        price1CumulativeLast = _initialPriceB;

        price0Average = FixedPoint.uq112x112(uint224(price0CumulativeLast));
        price1Average = FixedPoint.uq112x112(uint224(price1CumulativeLast));
    }

    function update() external {
        price0CumulativeLast = price0CumulativeLast;
        price1CumulativeLast = price1CumulativeLast;

        price0Average = FixedPoint.uq112x112(uint224(price0CumulativeLast));
        price1Average = FixedPoint.uq112x112(uint224(price1CumulativeLast));

        emit Updated(price0CumulativeLast, price1CumulativeLast);
    }

    function consult(address token, uint256 amountIn)
        external
        view
        returns (uint144 amountOut)
    {
        if (token == token0) {
            amountOut = price0Average.mul(amountIn).decode144();
        } else {
            require(token == token1, 'Oracle: INVALID_TOKEN');
            amountOut = price1Average.mul(amountIn).decode144();
        }
    }

    event Updated(uint256 price0CumulativeLast, uint256 price1CumulativeLast);
}

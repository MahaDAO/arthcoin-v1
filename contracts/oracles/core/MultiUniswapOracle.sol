// SPDX-License-Identifier: MIT

pragma solidity ^0.6.0;

import '@openzeppelin/contracts/math/SafeMath.sol';

import '../../lib/Babylonian.sol';
import '../../lib/FixedPoint.sol';
import '../../lib/UniswapV2Library.sol';
import '../../lib/UniswapV2OracleLibrary.sol';
import '../../utils/Epoch.sol';
import '../../interfaces/IUniswapV2Router02.sol';
import '../../interfaces/IMultiUniswapOracle.sol';

// A simple oracle that finds the price of 1 unit of an asset from Uniswap; after following a route
contract MultiUniswapOracle is IMultiUniswapOracle, Epoch {
    using FixedPoint for *;
    using SafeMath for uint256;

    /* ========== STATE VARIABLES ========== */

    // uniswap
    address public uniswapRouter;
    address public token0;
    address public token1;
    address public token2;
    address public token3;

    uint256 public tokensCount;
    uint256 price;

    /* ========== CONSTRUCTOR ========== */

    constructor(
        address _uniswapRouter,
        address _tokenA,
        address _tokenB,
        address _tokenC,
        address _tokenD,
        uint256 _tokensCount,
        uint256 _period,
        uint256 _startTime
    ) public Epoch(_period, _startTime, 0) {
        require(_tokensCount >= 2, 'At least two tokens');
        require(_tokensCount <= 4, 'At most four tokens');

        uniswapRouter = _uniswapRouter;

        token0 = _tokenA;
        token1 = _tokenB;
        token2 = _tokenC;
        token3 = _tokenD;

        tokensCount = _tokensCount;
    }

    /* ========== MUTABLE FUNCTIONS ========== */

    /** @dev Updates 1-day EMA price from Uniswap.  */
    function update() public override checkEpoch {
        address[] memory path = new address[](tokensCount);

        if (tokensCount == 2) {
            path[0] = address(token0);
            path[1] = address(token1);
        }
        if (tokensCount == 3) {
            path[0] = address(token0);
            path[1] = address(token1);
            path[2] = address(token2);
        } else {
            path[0] = address(token0);
            path[1] = address(token1);
            path[2] = address(token2);
            path[3] = address(token3);
        }

        // estimate price from uniswap
        uint256[] memory amountsOut =
            IUniswapV2Router02(uniswapRouter).getAmountsOut(1e18, path);
        price = amountsOut[tokensCount - 1];

        emit Updated(price);
    }

    function getPrice() public view override returns (uint256 amountOut) {
        return price;
    }

    event Updated(uint256 price);
}

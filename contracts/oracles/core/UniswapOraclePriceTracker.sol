// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import '@openzeppelin/contracts/math/SafeMath.sol';
import '@openzeppelin/contracts/access/Ownable.sol';

import './UniswapOracle.sol';
import '../../lib/Babylonian.sol';
import '../../lib/FixedPoint.sol';
import '../../lib/UniswapV2Library.sol';
import '../../interfaces/IUniswapOracle.sol';
import '../../lib/UniswapV2OracleLibrary.sol';

contract UniswapOraclePriceTracker is Ownable {
    using FixedPoint for *;
    using SafeMath for uint256;

    address public uniswapOraclePair;
    address public uniswapOracleToken0;
    address public uniswapOracleToken1;
    UniswapOracle public uniswapOracle;

    constructor(address oracle) public {
        uniswapOracle = UniswapOracle(oracle);

        // These are like supposed to be constant, so set them only once.
        uniswapOraclePair = address(uniswapOracle.pair());
        uniswapOracleToken0 = address(uniswapOracle.token0());
        uniswapOracleToken1 = address(uniswapOracle.token1());
    }

    function setUniswapOracle(address newOracle) public onlyOwner {
        require(newOracle != address(0), 'Tracker: invalid orcale');
        require(address(uniswapOracle) != newOracle, 'Tracker: same oracle');

        address oldOracle = address(uniswapOracle);

        uniswapOracle = UniswapOracle(newOracle);

        // Change the params as per new oracle.
        uniswapOraclePair = address(uniswapOracle.pair());
        uniswapOracleToken0 = address(uniswapOracle.token0());
        uniswapOracleToken1 = address(uniswapOracle.token1());

        emit OracleChanged(oldOracle, newOracle);
    }

    function getTokenPriceAtAmount(address token, uint256 amountIn)
        public
        view
        returns (uint224 amountOut)
    {
        // Get the up-to-date updated at timestamp from the uniswap oracle.
        uint32 blockTimestampLast = uint32(uniswapOracle.blockTimestampLast());

        // Get latest time and prices for the oracle.
        (
            uint256 price0Cumulative,
            uint256 price1Cumulative,
            uint32 blockTimestamp
        ) =
            UniswapV2OracleLibrary.currentCumulativePrices(
                address(uniswapOraclePair)
            );

        // Calculate the time difference for the TWAP.
        uint32 timeElapsed = blockTimestamp - blockTimestampLast; // overflow is desired

        // Check if time diff between latest update and the one previous to that update is significant or not.
        if (timeElapsed > 0) {
            // If time diff is significant only then we calculate the twap.

            // Get the up-to-date cumulative prices from the uniswap oracle.
            uint256 price0CumulativeLast =
                uint256(uniswapOracle.price0CumulativeLast());
            uint256 price1CumulativeLast =
                uint256(uniswapOracle.price1CumulativeLast());

            // Calculate the current TWAP based price.
            FixedPoint.uq112x112 memory avg0 =
                FixedPoint.uq112x112(
                    uint224(
                        (price0Cumulative - price0CumulativeLast) / timeElapsed
                    )
                );
            FixedPoint.uq112x112 memory avg1 =
                FixedPoint.uq112x112(
                    uint224(
                        (price1Cumulative - price1CumulativeLast) / timeElapsed
                    )
                );

            // Get the value of token according to amountIn based on calculated TWAP price.
            if (token == uniswapOracleToken0) {
                amountOut = avg0.mul(amountIn).decode144();
            } else {
                require(token == uniswapOracleToken1, 'Oracle: INVALID_TOKEN');

                amountOut = avg1.mul(amountIn).decode144();
            }
        } else {
            // If not significant, then we return the value as per the last twap price.

            // Get the up-to-date cumulative prices from the uniswap oracle.
            FixedPoint.uq112x112 memory price0Average =
                FixedPoint.uq112x112(uniswapOracle.price0Average());
            FixedPoint.uq112x112 memory price1Average =
                FixedPoint.uq112x112(uniswapOracle.price1Average());

            if (token == uniswapOracleToken0) {
                amountOut = price0Average.mul(amountIn).decode144();
            } else {
                require(token == uniswapOracleToken1, 'Oracle: INVALID_TOKEN');

                amountOut = price1Average.mul(amountIn).decode144();
            }
        }

        return amountOut;
    }

    event OracleChanged(address oldOracle, address newOracle);
}

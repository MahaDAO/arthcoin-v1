// SPDX-License-Identifier: MIT

pragma solidity ^0.6.0;

import './IOracle.sol';

interface IUniswapOracle {
    function update() external;

    function consult(address token, uint256 amountIn)
        external
        view
        returns (uint144 amountOut);
}

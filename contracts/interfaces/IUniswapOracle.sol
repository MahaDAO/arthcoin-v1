// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import {IEpoch} from './IEpoch.sol';

interface IUniswapOracle is IEpoch {
    function update() external;

    function consult(address token, uint256 amountIn)
        external
        view
        returns (uint256 amountOut);
}

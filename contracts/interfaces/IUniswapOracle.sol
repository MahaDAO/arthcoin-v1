// SPDX-License-Identifier: MIT

pragma solidity ^0.6.12;

import {IEpoch} from './IEpoch.sol';

interface IUniswapOracle is IEpoch {
    function update() external;

    function consult(address token, uint256 amountIn)
        external
        view
        returns (uint256 amountOut);
}

// SPDX-License-Identifier: MIT

pragma solidity ^0.6.0;

import '@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol'

import './owner/Operator.sol';
import './interfaces/IGMUOracle.sol';

contract SwapETHForTOKEN is Operator {
    address public uniswapRouter;
    address public incentiveToken;
    address public tokenForSwap;
    address public oracle;

    constructor (
        address uniswapRouter_, 
        address incentiveToken_, 
        address tokenForSwap_,
        address oracle_
    ) public {
        uniswapRouter = uniswapRouter_;
        incentiveToken = incentiveToken_;
        tokenForSwap = tokenForSwap_;
        oracle = oracle;
    }

    function changeIncentiveToken (address newIncentiveToken) 
        public 
        onlyOperator 
    {
        require(newIncentiveToken != address(0));

        incentiveToken = newIncentiveToken;
    }

    function changeTokenForSwap (address newTokenForSwap) 
        public 
        onlyOperator 
    {
        require(newTokenForSwap != address(0));

        tokenForSwap = newTokenForSwap;
    }

    function changeUniSwapRouter (address newUniswapRouter) 
        public 
        onlyOperator 
    {
        require(newUniswapRouter != address(0));

        uniswapRouter = newUniswapRouter;
    }

    function changeOracle (address newOracle) 
        public 
        onlyOperator 
    {
        require(newOracle != address(0));

        oracle = newOracle;
    }

    function changeEntities (
        address newUniswapRouter, 
        address newIncentiveToken, 
        address newTokenForSwap,
        address newOracle
    ) 
        public 
        onlyOperator 
    {
        require(newOracle != address(0));
        require(newIncentiveToken != address(0));
        require(newTokenForSwap != address(0));
        require(newUniswapRouter != address(0));

        uniswapRouter = newUniswapRouter;
        incentiveToken = newIncentiveToken;
        tokenForSwap = newTokenForSwap;
        oracle = newOracle;
    }

    function swap(uint256 amount) returns (uint[]) {
        require(amount > 0);
        
        uint256 tokenToETHPrice = IGMUOracle(oracle).getPrice();
        uint256 expectedTokenAmount = amount.div(tokenToETHPrice);
        
        // TODO: mint bond tokens.

        address[] memory path = new address[](2);
        path[0] = address(DAI);
        path[1] = UniswapV2Router02.WETH();


        uint[] memory result = IUniswapV2Router02(uniswapRouter).swapETHForExactTokens(
            expectedTokenAmount,
            amount, 
            path, 
            msg.sender, 
            block.timestamp
        );

        return result;
    }
}

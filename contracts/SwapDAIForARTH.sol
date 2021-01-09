// SPDX-License-Identifier: MIT

pragma solidity ^0.6.0;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol'

import './owner/Operator.sol';
import './interfaces/IGMUOracle.sol';

contract SwapETHForTOKEN is Operator {
    address public dai;
    address public cash;
    address public bond;
    address public oracle;
    address public uniswapRouter;

    constructor (
        address dai_,
        address cash_,
        address bond_,
        address oracle_,
        address uniswapRouter_,
    ) public {
        dai = dai_;
        cash = cash_;
        bond = bond_;
        oracle = oracle_;
        uniswapRouter = uniswapRouter_;
    }

    function changeBondToken (address newBond) 
        public 
        onlyOperator 
    {
        require(newBondToken != address(0));

        bond = newBond;
    }

    function changeCashToken (address newCash) 
        public 
        onlyOperator 
    {
        require(newCash != address(0));

        cash = newCash;
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
        address newCash, 
        address newBond, 
        address newOracle,
        address newUniswapRouter
    ) 
        public 
        onlyOperator 
    {
        require(newCash != address(0));
        require(newBond != address(0));
        require(newOracle != address(0));
        require(newUniswapRouter != address(0));

        cash = newCash;
        bond = newBond;
        oracle = newOracle;
        uniswapRouter = newUniswapRouter;
    }

    function swap(uint256 daiAmount) returns (uint[]) {
        require(amount > 0);
        
        uint256 tokenToETHPrice = IGMUOracle(oracle).getPrice();
        uint256 expectedTokenAmount = amount.div(tokenToETHPrice);
        
        // TODO: mint bond tokens.
        
        address[] memory path = new address[](2);
        path[0] = address(dai);
        path[1] = address(cash);

        uint[] memory result = IUniswapV2Router02(uniswapRouter).swapExactTokensForTokens(
            daiAmount,
            daiAmount, 
            path, 
            msg.sender, 
            block.timestamp
        );

        return result;
    }
}

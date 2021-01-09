// SPDX-License-Identifier: MIT

pragma solidity ^0.6.0;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol'

import './owner/Operator.sol';
import './interfaces/IOracle.sol';

contract SwapETHForTOKEN is Operator {
    address public dai;
    address public cash;
    address public bond;
    address public oracle;
    address public rewardRate;
    address public uniswapRouter;

    constructor (
        address dai_,
        address cash_,
        address bond_,
        address oracle_,
        address uniswapRouter_,
        uint256 rewardRate_
    ) public {
        dai = dai_;
        cash = cash_;
        bond = bond_;
        oracle = oracle_;
        rewardRate = rewardRate_;
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

    function changeRewardRate (uint256 newRewardRate) 
        public 
        onlyOperator 
    {
        require(rewardRate >= 0);
        require(rewardRate <= 100);

        rewardRate = newRewardRate;
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
        
        // Get price of dai.
        uint256 daiPrice = IOracle(oracle).consult(dai.address, 1);
        // Get price of cash.
        uint256 cashPrice = IOracle(oracle).consult(cash.address, 1);
        
        // Eg. Let's say 1 dai(d) = 10 usd and 1 cash(c) = 20 usd.
        // Then taking c/d = 20/10 = 2.
        // Then c = 2d.
        uint256 expectedCashAmount = cashPrice.div(daiPrice);
        
        uint256 rewardAmount = daiAmount.mul(rewardRate).div(100);
        IERC20(bond).mint(msg.sender, rewardAmount);

        address[] memory path = new address[](2);
        path[0] = address(dai);
        path[1] = address(cash);

        uint[] memory result = IUniswapV2Router02(uniswapRouter).swapExactTokensForTokens(
            daiAmount,
            expectedCashAmount, 
            path, 
            msg.sender, 
            block.timestamp
        );
        
        // TODO: Burn bought back arth.
        
        return result;
    }
}

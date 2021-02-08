// SPDX-License-Identifier: MIT

pragma solidity ^0.6.12;

import {IUniswapV2Router02} from '../interfaces/IUniswapV2Router02.sol';

import '../interfaces/IBoardroom.sol';
import '../interfaces/IBasisAsset.sol';
import '../interfaces/ISimpleERCFund.sol';
import './TreasuryGetters.sol';

abstract contract TreasurySetters is TreasuryGetters {
    function setEcosystemFund(address newFund, uint256 rate) public onlyOwner {
        require(rate <= 100, 'rate >= 0');
        ecosystemFund = newFund;
        ecosystemFundAllocationRate = rate;
        emit FundChanged(newFund, rate, 'ecosystemFund');
    }

    function setRainyDayFund(address newFund, uint256 rate) public onlyOwner {
        require(rate <= 100, 'rate >= 0');
        rainyDayFund = newFund;
        rainyDayFundAllocationRate = rate;
        emit FundChanged(newFund, rate, 'rainyDayFund');
    }

    function setBondDiscount(uint256 rate) public onlyOwner returns (uint256) {
        require(rate <= 100, 'rate >= 0');
        bondDiscount = rate;
    }

    function setConsiderUniswapLiquidity(bool val) public onlyOwner {
        considerUniswapLiquidity = val;
    }

    function setMaxDebtIncreasePerEpoch(uint256 rate) public onlyOwner {
        require(rate <= 100, 'rate >= 0');
        maxDebtIncreasePerEpoch = rate;
    }

    function setMaxSupplyIncreasePerEpoch(uint256 rate) public onlyOwner {
        require(rate <= 100, 'rate >= 0');
        maxSupplyIncreasePerEpoch = rate;
    }

    function setSafetyRegion(uint256 rate) public onlyOwner returns (uint256) {
        require(rate <= 100, 'rate >= 0');
        safetyRegion = rate;
    }

    function setArthBoardroom(address newFund, uint256 rate) public onlyOwner {
        require(rate <= 100, 'rate >= 0');
        arthBoardroom = newFund;
        arthBoardroomAllocationRate = rate;
        emit BoardroomChanged(newFund, rate, 'arth');
    }

    function setArthLiquidityBoardroom(address newFund, uint256 rate)
        public
        onlyOwner
    {
        require(rate <= 100, 'rate >= 0');
        arthLiquidityBoardroom = newFund;
        arthLiquidityBoardroomAllocationRate = rate;
        emit BoardroomChanged(newFund, rate, 'arthLiquidity');
    }

    function setMahaLiquidityBoardroom(address newFund, uint256 rate)
        public
        onlyOwner
    {
        require(rate <= 100, 'rate >= 0');
        mahaLiquidityBoardroom = newFund;
        mahaLiquidityBoardroomAllocationRate = rate;
        emit BoardroomChanged(newFund, rate, 'mahaLiquidity');
    }

    function setBondRedeemptionBoardroom(address newFund, uint256 rate)
        public
        onlyOwner
    {
        require(rate <= 100, 'rate >= 0');
        bondRedeemptionBoardroom = newFund;
        bondSeigniorageRate = rate;
        emit BoardroomChanged(newFund, rate, 'bondReemption');
    }

    // ORACLE
    function setUniswap1hrOracle(address newOracle) public onlyOwner {
        uniswap1hrOracle = newOracle;
        
        emit OracleChanged(newOracle, '1hr');
    }

    function setUniswap12hrOracle(address newOracle) public onlyOwner {
        uniswap12hrOracle = newOracle;

        emit OracleChanged(newOracle, '12hr');
    }

    function setGMUOracle(address newOracle) public onlyOwner {
        gmuOracle = newOracle;
        emit OracleChanged(newOracle, 'gmu');
    }

    event OracleChanged(address newOracle, string kind);
    event FundChanged(address newFund, uint256 newRate, string kind);
    event BoardroomChanged(address newFund, uint256 newRate, string kind);
    event StabilityFeeChanged(uint256 old, uint256 newRate);
}

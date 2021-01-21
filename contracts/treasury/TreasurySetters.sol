// SPDX-License-Identifier: MIT

pragma solidity ^0.6.12;

import '@openzeppelin/contracts/math/Math.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';
import '@openzeppelin/contracts/utils/ReentrancyGuard.sol';

import {IUniswapV2Router02} from '../interfaces/IUniswapV2Router02.sol';
import '../interfaces/IOracle.sol';
import '../interfaces/IBoardroom.sol';
import '../interfaces/IBasisAsset.sol';
import '../interfaces/ISimpleERCFund.sol';
import '../lib/Babylonian.sol';
import '../lib/FixedPoint.sol';
import '../lib/Safe112.sol';
import '../owner/Operator.sol';
import '../utils/Epoch.sol';
import '../utils/ContractGuard.sol';
import './TreasuryGetters.sol';

abstract contract TreasurySetters is TreasuryGetters {
    function setStabilityFee(uint256 _stabilityFee) public onlyOwner {
        require(_stabilityFee > 0, 'Treasury: fee < 0');
        require(_stabilityFee < 100, 'Treasury: fee >= 0');
        stabilityFee = _stabilityFee;

        emit StabilityFeeChanged(stabilityFee, _stabilityFee);
    }

    function setFund(address newFund, uint256 rate) public onlyOwner {
        require(rate >= 0, 'Treasury: rate < 0');
        require(rate < 100, 'Treasury: rate >= 0');

        ecosystemFund = newFund;
        ecosystemFundAllocationRate = rate;

        emit EcosystemFundChanged(newFund, rate);
    }

    function setBondDiscount(uint256 rate) public onlyOwner returns (uint256) {
        require(rate >= 0, 'Treasury: rate should be <= 0');
        require(rate <= 100, 'Treasury: rate should be >= 0');
        bondDiscount = rate;
    }

    function setSafetyRegion(uint256 rate) public onlyOwner returns (uint256) {
        require(rate >= 0, 'Treasury: rate should be <= 0');
        require(rate <= 100, 'Treasury: rate should be >= 0');
        safetyRegion = rate;
    }

    function setBondSeigniorageRate(uint256 rate) public onlyOwner {
        require(rate >= 0, 'Treasury: rate < 0');
        require(rate <= 100, 'Treasury: rate >= 0');

        bondSeigniorageRate = rate;

        emit BondSeigniorageRateChanged(rate);
    }

    function setArthBoardroom(address newFund, uint256 rate) public onlyOwner {
        require(rate >= 0, 'Treasury: rate < 0');
        require(rate < 100, 'Treasury: rate >= 0');

        arthBoardroom = newFund;
        arthBoardroomAllocationRate = rate;

        emit BoardroomChanged(newFund, rate, 'arth');
    }

    function setArthLiquidityBoardroom(address newFund, uint256 rate)
        public
        onlyOwner
    {
        require(rate >= 0, 'Treasury: rate < 0');
        require(rate < 100, 'Treasury: rate >= 0');

        arthLiquidityBoardroom = newFund;
        arthLiquidityBoardroomAllocationRate = rate;

        emit BoardroomChanged(newFund, rate, 'arthLiquidity');
    }

    function setMahaLiquidityBoardroom(address newFund, uint256 rate)
        public
        onlyOwner
    {
        require(rate >= 0, 'Treasury: rate < 0');
        require(rate < 100, 'Treasury: rate >= 0');

        mahaLiquidityBoardroom = newFund;
        mahaLiquidityBoardroomAllocationRate = rate;

        emit BoardroomChanged(newFund, rate, 'mahaLiquidity');
    }

    // ORACLE
    function setBondOracle(address newOracle) public onlyOwner {
        address oldOracle = bondOracle;
        bondOracle = newOracle;
        emit OracleChanged(msg.sender, oldOracle, newOracle, 'bondOracle');
    }

    function setSeigniorageOracle(address newOracle) public onlyOwner {
        address oldOracle = seigniorageOracle;
        seigniorageOracle = newOracle;
        emit OracleChanged(
            msg.sender,
            oldOracle,
            newOracle,
            'seigniorageOracle'
        );
    }

    function setGMUOracle(address newOracle) public onlyOwner {
        address oldOracle = seigniorageOracle;
        gmuOracle = newOracle;
        emit OracleChanged(msg.sender, oldOracle, newOracle, 'gmuOracle');
    }

    function setArthMahaOracle(address newOracle) public onlyOwner {
        address oldOracle = seigniorageOracle;
        arthMahaOracle = newOracle;
        emit OracleChanged(msg.sender, oldOracle, newOracle, 'arthMahaOracle');
    }

    event OracleChanged(
        address indexed operator,
        address oldOracle,
        address newOracle,
        string label
    );
    event EcosystemFundChanged(address newFund, uint256 newRate);
    event BoardroomChanged(address newFund, uint256 newRate, string label);
    event StabilityFeeChanged(uint256 old, uint256 newRate);
    event BondSeigniorageRateChanged(uint256 newRate);
}

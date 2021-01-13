// SPDX-License-Identifier: MIT

pragma solidity ^0.6.0;

import '@openzeppelin/contracts/math/Math.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';
import '@openzeppelin/contracts/utils/ReentrancyGuard.sol';
import '@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol';

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
import '../interfaces/IGMUOracle.sol';
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

    function setArthBoardroom(address newFund, uint256 rate) public onlyOwner {
        require(rate >= 0, 'Treasury: rate < 0');
        require(rate < 100, 'Treasury: rate >= 0');

        arthBoardroom = newFund;
        arthBoardroomAllocationRate = rate;

        emit ArthBoardroomChanged(newFund, rate);
    }

    function setArthLiquidityBoardroom(address newFund, uint256 rate)
        public
        onlyOwner
    {
        require(rate >= 0, 'Treasury: rate < 0');
        require(rate < 100, 'Treasury: rate >= 0');

        arthLiquidityBoardroom = newFund;
        arthLiquidityBoardroomAllocationRate = rate;

        emit ArthLiquidityBoardroomChanged(newFund, rate);
    }

    event EcosystemFundChanged(address newFund, uint256 newRate);
    event ArthBoardroomChanged(address newFund, uint256 newRate);
    event ArthLiquidityBoardroomChanged(address newFund, uint256 newRate);
    event StabilityFeeChanged(uint256 old, uint256 newRate);
}

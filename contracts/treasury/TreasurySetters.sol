// SPDX-License-Identifier: MIT

pragma solidity ^0.6.12;

import {IUniswapV2Router02} from '../interfaces/IUniswapV2Router02.sol';

import '../interfaces/IBoardroom.sol';
import '../interfaces/IBasisAsset.sol';
import '../interfaces/ISimpleERCFund.sol';
import './TreasuryGetters.sol';

abstract contract TreasurySetters is TreasuryGetters {
    function setStabilityFee(uint256 _stabilityFee) public onlyOwner {
        require(_stabilityFee <= 100, 'rate >= 0');
        stabilityFee = _stabilityFee;
    }

    function setAllFunds(
        // boardrooms
        address _arthArthLiquidityMlpBoardroom,
        address _arthMahaBoardroom,
        address _arthArthBoardroom,
        address _mahaArthLiquidityMlpBoardroom,
        address _mahaMahaBoardroom,
        address _mahaArthBoardroom,
        // ecosystem fund
        address _fund,
        address _rainyDayFund
    ) public onlyOwner {
        arthArthLiquidityMlpBoardroom = _arthArthLiquidityMlpBoardroom;
        arthMahaBoardroom = _arthMahaBoardroom;
        arthArthBoardroom = _arthArthBoardroom;
        mahaArthLiquidityMlpBoardroom = _mahaArthLiquidityMlpBoardroom;
        mahaMahaBoardroom = _mahaMahaBoardroom;
        mahaArthBoardroom = _mahaArthBoardroom;

        ecosystemFund = _fund;
        rainyDayFund = _rainyDayFund;
    }

    function setFund(address expansionFund, uint256 rate) public onlyOwner {
        require(rate <= 100, 'rate >= 0');
        ecosystemFund = expansionFund;
        ecosystemFundAllocationRate = rate;
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

    function setSurprise(bool val) public onlyOwner {
        enableSurprise = val;
    }

    function setContractionRewardPerMonth(uint256 amount) public onlyOwner {
        contractionRewardPerEpoch = amount;
    }

    function setSafetyRegion(uint256 rate) public onlyOwner returns (uint256) {
        require(rate <= 100, 'rate >= 0');
        safetyRegion = rate;
    }

    function setBondSeigniorageRate(uint256 rate) public onlyOwner {
        require(rate <= 100, 'rate >= 0');
        bondSeigniorageRate = rate;
    }

    function setArthBoardroom(
        address expansionFund,
        address contractionFund,
        uint256 rate
    ) public onlyOwner {
        require(rate <= 100, 'rate >= 0');
        arthArthBoardroom = expansionFund;
        mahaArthBoardroom = contractionFund;
        arthBoardroomAllocationRate = rate;
    }

    function setArthLiquidityMlpBoardroom(
        address expansionFund,
        address contractionFund,
        uint256 rate
    ) public onlyOwner {
        require(rate <= 100, 'rate >= 0');
        arthArthLiquidityMlpBoardroom = expansionFund;
        mahaArthLiquidityMlpBoardroom = contractionFund;
        arthLiquidityMlpAllocationRate = rate;
    }

    function setMahaBoardroom(
        address expansionFund,
        address contractionFund,
        uint256 rate
    ) public onlyOwner {
        require(rate <= 100, 'rate >= 0');
        arthMahaBoardroom = expansionFund;
        mahaMahaBoardroom = contractionFund;
        mahaLiquidityBoardroomAllocationRate = rate;
    }

    // ORACLE
    function setBondOracle(address newOracle) public onlyOwner {
        bondOracle = newOracle;
    }

    function setSeigniorageOracle(address newOracle) public onlyOwner {
        seigniorageOracle = newOracle;
    }

    function setUniswapRouter(address val) public onlyOwner {
        uniswapRouter = val;
    }

    function setGMUOracle(address newOracle) public onlyOwner {
        gmuOracle = newOracle;
    }

    function setArthMahaOracle(address newOracle) public onlyOwner {
        arthMahaOracle = newOracle;
    }
}

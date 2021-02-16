// SPDX-License-Identifier: MIT

pragma solidity ^0.6.12;

import {IUniswapV2Router02} from '../interfaces/IUniswapV2Router02.sol';

import '../interfaces/IBoardroom.sol';
import '../interfaces/IBasisAsset.sol';
import '../interfaces/ISimpleERCFund.sol';
import './TreasuryGetters.sol';

abstract contract TreasurySetters is TreasuryGetters {
    // function setAllFunds(
    //     // boardrooms
    //     IBoardroom _arthArthLiquidityMlpBoardroom,
    //     IBoardroom _arthMahaBoardroom,
    //     IBoardroom _arthArthBoardroom,
    //     IBoardroom _mahaArthLiquidityMlpBoardroom,
    //     IBoardroom _mahaMahaBoardroom,
    //     IBoardroom _mahaArthBoardroom,
    //     // ecosystem fund
    //     ISimpleERCFund _fund,
    //     ISimpleERCFund _rainyDayFund
    // ) public onlyOwner {
    //     state.arthArthLiquidityMlpBoardroom = _arthArthLiquidityMlpBoardroom;
    //     state.arthMahaBoardroom = _arthMahaBoardroom;
    //     state.arthArthBoardroom = _arthArthBoardroom;
    //     state.mahaArthLiquidityMlpBoardroom = _mahaArthLiquidityMlpBoardroom;
    //     state.mahaMahaBoardroom = _mahaMahaBoardroom;
    //     state.mahaArthBoardroom = _mahaArthBoardroom;
    //     state.ecosystemFund = _fund;
    //     state.rainyDayFund = _rainyDayFund;
    // }

    function setFund(ISimpleERCFund expansionFund, uint256 rate)
        public
        onlyOwner
    {
        require(rate <= 100, 'rate >= 0');
        boardroomState.ecosystemFund = expansionFund;
        boardroomState.ecosystemFundAllocationRate = rate;
    }

    function setBondDiscount(uint256 rate) public onlyOwner returns (uint256) {
        require(rate <= 100, 'rate >= 0');
        state.bondDiscount = rate;
    }

    function setConsiderUniswapLiquidity(bool val) public onlyOwner {
        state.considerUniswapLiquidity = val;
    }

    function setMaxDebtIncreasePerEpoch(uint256 rate) public onlyOwner {
        require(rate <= 100, 'rate >= 0');
        state.maxDebtIncreasePerEpoch = rate;
    }

    function setMaxSupplyIncreasePerEpoch(uint256 rate) public onlyOwner {
        require(rate <= 100, 'rate >= 0');
        state.maxSupplyIncreasePerEpoch = rate;
    }

    function setSurprise(bool val) public onlyOwner {
        state.enableSurprise = val;
    }

    function setContractionRewardPerMonth(uint256 amount) public onlyOwner {
        state.contractionRewardPerEpoch = amount;
    }

    function setSafetyRegion(uint256 rate) public onlyOwner returns (uint256) {
        require(rate <= 100, 'rate >= 0');
        state.safetyRegion = rate;
    }

    function setBondSeigniorageRate(uint256 rate) public onlyOwner {
        require(rate <= 100, 'rate >= 0');
        state.bondSeigniorageRate = rate;
    }

    function setArthBoardroom(
        IBoardroom expansionFund,
        IBoardroom contractionFund,
        uint256 rate
    ) public onlyOwner {
        require(rate <= 100, 'rate >= 0');
        boardroomState.arthArthBoardroom = expansionFund;
        boardroomState.mahaArthBoardroom = contractionFund;
        boardroomState.arthBoardroomAllocationRate = rate;
    }

    function setArthLiquidityMlpBoardroom(
        IBoardroom expansionFund,
        IBoardroom contractionFund,
        uint256 rate
    ) public onlyOwner {
        require(rate <= 100, 'rate >= 0');
        boardroomState.arthArthLiquidityMlpBoardroom = expansionFund;
        boardroomState.mahaArthLiquidityMlpBoardroom = contractionFund;
        boardroomState.arthLiquidityMlpAllocationRate = rate;
    }

    function setMahaBoardroom(
        IBoardroom expansionFund,
        IBoardroom contractionFund,
        uint256 rate
    ) public onlyOwner {
        require(rate <= 100, 'rate >= 0');
        boardroomState.arthMahaBoardroom = expansionFund;
        boardroomState.mahaMahaBoardroom = contractionFund;
        boardroomState.mahaLiquidityBoardroomAllocationRate = rate;
    }

    function setOracles(
        IUniswapOracle _bondOracle,
        IUniswapOracle _seigniorageOracle,
        ISimpleOracle _gmuOracle,
        ISimpleOracle _arthMahaOracle
    ) public onlyOwner {
        oracleState.bondOracle = _bondOracle;
        oracleState.seigniorageOracle = _seigniorageOracle;
        oracleState.gmuOracle = _gmuOracle;
        oracleState.arthMahaOracle = _arthMahaOracle;
    }

    function setUniswapRouter(IUniswapV2Router02 val) public onlyOwner {
        state.uniswapRouter = val;
    }

    function setStabilityFee(uint256 _stabilityFee) public onlyOwner {
        require(_stabilityFee <= 100, 'rate >= 0');
        state.stabilityFee = _stabilityFee;
    }
}

// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import {IBoardroom} from '../interfaces/IBoardroom.sol';
import {ISimpleERCFund} from '../interfaces/ISimpleERCFund.sol';
import {ISimpleOracle} from '../interfaces/ISimpleOracle.sol';
import {IUniswapOracle} from '../interfaces/IUniswapOracle.sol';
import {IUniswapV2Router02} from '../interfaces/IUniswapV2Router02.sol';
import {TreasuryGetters} from './TreasuryGetters.sol';

abstract contract TreasurySetters is TreasuryGetters {
    // todo; add a set state

    function setAllFunds(
        IBoardroom _arthArthLiquidityMlpBoardroom,
        IBoardroom _arthMahaBoardroom,
        IBoardroom _arthArthBoardroom,
        IBoardroom _mahaArthLiquidityMlpBoardroom,
        IBoardroom _mahaMahaBoardroom,
        IBoardroom _mahaArthBoardroom,
        ISimpleERCFund _fund,
        ISimpleERCFund _rainyDayFund
    ) public onlyOwner {
        boardroomState
            .arthArthLiquidityMlpBoardroom = _arthArthLiquidityMlpBoardroom;
        boardroomState.arthMahaBoardroom = _arthMahaBoardroom;
        boardroomState.arthArthBoardroom = _arthArthBoardroom;
        boardroomState
            .mahaArthLiquidityMlpBoardroom = _mahaArthLiquidityMlpBoardroom;
        boardroomState.mahaMahaBoardroom = _mahaMahaBoardroom;
        boardroomState.mahaArthBoardroom = _mahaArthBoardroom;
        boardroomState.ecosystemFund = _fund;
        boardroomState.rainyDayFund = _rainyDayFund;
    }

    function setEcosystemFund(ISimpleERCFund fund, uint256 rate)
        public
        onlyOwner
    {
        require(rate <= 100, 'rate >= 0');
        boardroomState.ecosystemFund = fund;
        boardroomState.ecosystemFundAllocationRate = rate;
    }

    function setRainyDayFund(ISimpleERCFund fund, uint256 rate)
        public
        onlyOwner
    {
        require(rate <= 100, 'rate >= 0');
        boardroomState.rainyDayFund = fund;
        boardroomState.rainyDayFundAllocationRate = rate;
    }

    function setBondDiscount(uint256 rate) public onlyOwner {
        require(rate <= 100, 'rate >= 0');
        state.bondDiscount = rate;
    }

    function setConsiderUniswapLiquidity(bool val) public onlyOwner {
        flags.considerUniswapLiquidity = val;
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
        flags.enableSurprise = val;
    }

    function setContractionRewardPerEpoch(uint256 amount) public onlyOwner {
        state.contractionRewardPerEpoch = amount;
    }

    function setSafetyRegion(uint256 rate) public onlyOwner {
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
        boardroomState.arthAllocationRate = rate;
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
        boardroomState.mahaAllocationRate = rate;
    }

    function setOracles(
        IUniswapOracle _oracle1hrTWAP,
        IUniswapOracle _oracle12hrTWAP,
        ISimpleOracle _gmuOracle
    ) public onlyOwner {
        oracleState.oracle1hrTWAP = _oracle1hrTWAP;
        oracleState.oracle12hrTWAP = _oracle12hrTWAP;
        oracleState.gmuOracle = _gmuOracle;
    }

    function setUniswapRouter(IUniswapV2Router02 val, address pair)
        public
        onlyOwner
    {
        state.uniswapRouter = val;
        state.uniswapLiquidityPair = pair;
    }
}

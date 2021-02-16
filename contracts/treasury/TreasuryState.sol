// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import {SafeMath} from '@openzeppelin/contracts/contracts/math/SafeMath.sol';
import {IERC20} from '@openzeppelin/contracts/contracts/token/ERC20/IERC20.sol';
import {IBasisAsset} from '../interfaces/IBasisAsset.sol';
import {FixedPoint} from '../lib/FixedPoint.sol';
import {Safe112} from '../lib/Safe112.sol';
import {Operator} from '../owner/Operator.sol';
import {Epoch} from '../utils/Epoch.sol';
import {ContractGuard} from '../utils/ContractGuard.sol';
import {ISimpleOracle} from '../interfaces/ISimpleOracle.sol';
import {IUniswapOracle} from '../interfaces/IUniswapOracle.sol';
import {IUniswapV2Router02} from '../interfaces/IUniswapV2Router02.sol';
import {IBoardroom} from '../interfaces/IBoardroom.sol';
import {ISimpleERCFund} from '../interfaces/ISimpleERCFund.sol';
import {TreasuryLibrary} from './TreasuryLibrary.sol';

abstract contract TreasuryState is ContractGuard, Epoch {
    using FixedPoint for *;
    using SafeMath for uint256;
    using Safe112 for uint112;

    IERC20 dai;
    IBasisAsset cash;
    IBasisAsset bond;
    IERC20 share;

    TreasuryLibrary.BoardroomState internal boardroomState;
    TreasuryLibrary.OracleState internal oracleState;
    TreasuryLibrary.State internal state;

    constructor(
        uint256 _startTime,
        uint256 _period,
        uint256 _startEpoch
    ) Epoch(_period, _startTime, _startEpoch) {
        // init defaults
        boardroomState.arthBoardroomAllocationRate = 20;
        boardroomState.arthLiquidityMlpAllocationRate = 70;
        boardroomState.mahaLiquidityBoardroomAllocationRate = 10;
        boardroomState.ecosystemFundAllocationRate = 2;
        boardroomState.rainyDayFundAllocationRate = 2;
        state.accumulatedBonds = 0;
        state.accumulatedSeigniorage = 0;
        state.bondDiscount = 20;
        state.bondSeigniorageRate = 90;
        state.cashTargetPrice = 1e18;
        state.cashToBondConversionLimit = 0;
        state.considerUniswapLiquidity = false;
        state.contractionRewardPerEpoch = 0;
        state.enableSurprise = false;
        state.initialized = false;
        state.maxDebtIncreasePerEpoch = 5;
        state.maxSupplyIncreasePerEpoch = 10;
        state.migrated = false;
        state.safetyRegion = 5;
        state.stabilityFee = 1;
    }

    modifier checkMigration {
        require(!state.migrated, 'Treasury: migrated');
        _;
    }

    modifier checkOperator {
        require(
            cash.operator() == address(this) &&
                bond.operator() == address(this) &&
                boardroomState.arthArthLiquidityMlpBoardroom.operator() ==
                address(this) &&
                boardroomState.arthMahaBoardroom.operator() == address(this) &&
                boardroomState.arthArthBoardroom.operator() == address(this) &&
                boardroomState.mahaArthLiquidityMlpBoardroom.operator() ==
                address(this) &&
                boardroomState.mahaMahaBoardroom.operator() == address(this) &&
                boardroomState.mahaArthBoardroom.operator() == address(this),
            'Treasury: need more permission'
        );
        _;
    }
}

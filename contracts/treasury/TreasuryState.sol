// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import {ContractGuard} from '../utils/ContractGuard.sol';
import {Epoch} from '../utils/Epoch.sol';
import {IBasisAsset} from '../interfaces/IBasisAsset.sol';
import {IERC20} from '@openzeppelin/contracts/contracts/token/ERC20/IERC20.sol';
import {Operator} from '../owner/Operator.sol';
import {TreasuryLibrary} from './TreasuryLibrary.sol';
import {RBAC} from './RBAC.sol';

abstract contract TreasuryState is ContractGuard, Epoch {
    IERC20 public dai;
    IBasisAsset public cash;
    IBasisAsset public bond;
    IERC20 public share;
    RBAC public rbac;

    TreasuryLibrary.BoardroomState public boardroomState;
    TreasuryLibrary.OracleState public oracleState;
    TreasuryLibrary.State public state;

    constructor(
        uint256 _startTime,
        uint256 _period,
        uint256 _startEpoch
    ) Epoch(_period, _startTime, _startEpoch) {
        // init defaults
        boardroomState.arthAllocationRate = 20;
        boardroomState.arthLiquidityMlpAllocationRate = 70;
        boardroomState.mahaAllocationRate = 10;

        boardroomState.ecosystemFundAllocationRate = 2;
        boardroomState.rainyDayFundAllocationRate = 2;

        state.accumulatedBonds = 0;
        state.accumulatedSeigniorage = 0;
        state.bondDiscount = 20;
        state.bondSeigniorageRate = 90;
        state.cashTargetPrice = 1e18; // 1$
        state.cashToBondConversionLimit = 0;
        state.considerUniswapLiquidity = false;
        state.contractionRewardPerEpoch = 0;
        state.enableSurprise = false;
        state.initialized = false;
        state.maxDebtIncreasePerEpoch = 5;
        state.maxSupplyIncreasePerEpoch = 10;
        state.migrated = false;
        state.safetyRegion = 5;
    }

    modifier checkMigration {
        require(!state.migrated, 'Treasury: migrated');
        _;
    }

    modifier validateOperator {
        require(checkOperator(), 'Treasury: need more permission');
        _;
    }

    function checkOperator() public view returns (bool) {
        return (rbac.treasury() == address(this) &&
            boardroomState.arthArthLiquidityMlpBoardroom.operator() ==
            address(this) &&
            boardroomState.arthMahaBoardroom.operator() == address(this) &&
            boardroomState.arthArthBoardroom.operator() == address(this) &&
            boardroomState.mahaArthLiquidityMlpBoardroom.operator() ==
            address(this) &&
            boardroomState.mahaMahaBoardroom.operator() == address(this) &&
            boardroomState.mahaArthBoardroom.operator() == address(this));
    }
}

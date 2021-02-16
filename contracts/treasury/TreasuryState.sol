// SPDX-License-Identifier: MIT

pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import {SafeMath} from '@openzeppelin/contracts/math/SafeMath.sol';
import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {SafeERC20} from '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';
import {Address} from '@openzeppelin/contracts/utils/Address.sol';
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
    using SafeERC20 for IERC20;
    using Address for address;
    using SafeMath for uint256;
    using Safe112 for uint112;

    struct State {
        /* ========== STATE VARIABLES ========== */

        // ========== FLAGS
        bool migrated;
        bool initialized;
        // ========== CORE
        IUniswapV2Router02 uniswapRouter;
        address uniswapLiquidityPair;
        // cash price tracking vars
        uint256 cashTargetPrice;
        // these govern how much bond tokens are issued
        uint256 cashToBondConversionLimit;
        uint256 accumulatedBonds;
        // this governs how much cash tokens are issued
        uint256 accumulatedSeigniorage;
        // flag whether we should considerUniswapLiquidity or not.
        bool considerUniswapLiquidity;
        // used to limit how much of the supply is converted into bonds
        uint256 maxDebtIncreasePerEpoch; // in %
        // the discount given to bond purchasers
        uint256 bondDiscount; // in %
        // the band beyond which bond purchase or protocol expansion happens.
        uint256 safetyRegion; // in %
        // at the most how much % of the supply should be increased
        uint256 maxSupplyIncreasePerEpoch; // in %
        // this controls how much of the new seigniorage is given to bond token holders
        // when we are in expansion mode. ideally 90% of new seigniorate is
        // given to bond token holders.
        uint256 bondSeigniorageRate; // in %
        // stability fee is a special fee charged by the protocol in MAHA tokens
        // whenever a person is going to redeem his/her bonds. the fee is charged
        // basis how much ARTHB is being redeemed.
        //
        // eg: a 1% fee means that while redeeming 100 ARTHB, 1 ARTH worth of MAHA is
        // deducted to pay for stability fees.
        uint256 stabilityFee; // IN %;
        // amount of maha rewarded per epoch.
        uint256 contractionRewardPerEpoch;
        // wut? algo coin surprise sheeet?
        bool enableSurprise;
    }

    struct OracleState {
        IUniswapOracle bondOracle;
        IUniswapOracle seigniorageOracle;
        ISimpleOracle gmuOracle;
        ISimpleOracle arthMahaOracle;
    }

    IERC20 dai;
    IBasisAsset cash;
    IBasisAsset bond;
    IERC20 share;

    struct CoreState {
        State state;
    }

    TreasuryLibrary.BoardroomState internal boardroomState;
    OracleState public oracleState;
    State internal state;

    CoreState s;

    constructor(
        uint256 _startTime,
        uint256 _period,
        uint256 _startEpoch
    ) public Epoch(_period, _startTime, _startEpoch) {
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

    function getState() public view returns (State memory _state) {
        return s.state;
    }
}

// SPDX-License-Identifier: MIT

pragma solidity ^0.6.10;

import '@openzeppelin/contracts/math/Math.sol';
import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';
import '@openzeppelin/contracts/utils/ReentrancyGuard.sol';

import '../interfaces/ICustomERC20.sol';
import '../interfaces/IUniswapV2Factory.sol';

import {IUniswapOracle} from '../interfaces/IUniswapOracle.sol';
import {IUniswapV2Router02} from '../interfaces/IUniswapV2Router02.sol';
import {IBoardroom} from '../interfaces/IBoardroom.sol';
import {IBasisAsset} from '../interfaces/IBasisAsset.sol';
import {ISimpleERCFund} from '../interfaces/ISimpleERCFund.sol';
import {Operator} from '../owner/Operator.sol';
import {Epoch} from '../utils/Epoch.sol';
import {ContractGuard} from '../utils/ContractGuard.sol';

import './TreasurySetters.sol';

/**
 * @title ARTH Treasury contract
 * @notice Monetary policy logic to adjust supplies of basis cash assets
 * @author Steven Enamakel & Yash Agrawal. Original code written by Summer Smith & Rick Sanchez
 */
contract TreasuryHelpers is TreasurySetters {
    using SafeERC20 for ICustomERC20;

    constructor(
        address _dai,
        address _cash,
        address _bond,
        address _share,
        address _uniswap1hrOracle,
        address _uniswap12hrOracle,
        address _gmuOracle,
        // address _arthLiquidityBoardroom,
        // address _mahaLiquidityBoardroom,
        // address _arthBoardroom,
        // address _bondRedeemptionBoardroom,
        // address _ecosystemFund,
        // address _rainyDayFund,
        address _uniswapRouter,
        uint256 _startTime,
        uint256 _period,
        uint256 _startEpoch
    ) public Epoch(_period, _startTime, _startEpoch) {
        // tokens
        dai = _dai;
        cash = _cash;
        bond = _bond;
        share = _share;

        // oracles
        uniswap1hrOracle = _uniswap1hrOracle;
        uniswap12hrOracle = _uniswap12hrOracle;
        gmuOracle = _gmuOracle;

        // // funds
        // arthLiquidityBoardroom = _arthLiquidityBoardroom;
        // mahaLiquidityBoardroom = _mahaLiquidityBoardroom;
        // arthBoardroom = _arthBoardroom;
        // bondRedeemptionBoardroom = _bondRedeemptionBoardroom;
        // ecosystemFund = _ecosystemFund;
        // rainyDayFund = _rainyDayFund;

        // others
        uniswapRouter = _uniswapRouter;

        // _updateCashPrice();
    }

    modifier updatePrice {
        _;

        _updateCashPrice();
    }

    function initializeFunds(
        // Boardrooms
        address _arthLiquidityBoardroom,
        address _mahaLiquidityBoardroom,
        address _arthBoardroom,
        address _bondRedemtionBoardroom,
        // The Ecosystem fund
        address _ecosystemFund,
        // A rainy-day fund.
        address _rainyDayFund
    ) public onlyOwner {
        // Initilize different funds.

        require(
            _arthLiquidityBoardroom != address(0) &&
                _mahaLiquidityBoardroom != address(0) &&
                _arthBoardroom != address(0) &&
                _bondRedemtionBoardroom != address(0),
            'Treasury: invalid address'
        );

        require(
            _ecosystemFund != address(0) && _rainyDayFund != address(0),
            'Treasury: invalid address'
        );

        arthLiquidityBoardroom = _arthLiquidityBoardroom;
        mahaLiquidityBoardroom = _mahaLiquidityBoardroom;
        arthBoardroom = _arthBoardroom;
        bondRedeemptionBoardroom = _bondRedemtionBoardroom;
        ecosystemFund = _ecosystemFund;
        rainyDayFund = _rainyDayFund;

        emit FundsInitialied(
            // Boardrooms
            _arthLiquidityBoardroom,
            _mahaLiquidityBoardroom,
            _arthBoardroom,
            _bondRedemtionBoardroom,
            // The Ecosystem fund
            _ecosystemFund,
            // A rainy-day fund.
            _rainyDayFund
        );
    }

    function migrate(address target) public onlyOperator checkOperator {
        require(target != address(0), 'migrate to zero');
        require(!migrated, '!migrated');

        // TODO: check if the destination is a treasury or not

        // cash
        Operator(cash).transferOperator(target);
        Operator(cash).transferOwnership(target);
        ICustomERC20(cash).transfer(
            target,
            ICustomERC20(cash).balanceOf(address(this))
        );

        // bond
        Operator(bond).transferOperator(target);
        Operator(bond).transferOwnership(target);
        ICustomERC20(bond).transfer(
            target,
            ICustomERC20(bond).balanceOf(address(this))
        );

        // share - disabled ownership and operator functions as MAHA tokens don't have these
        ICustomERC20(share).transfer(
            target,
            ICustomERC20(share).balanceOf(address(this))
        );

        migrated = true;
        emit Migration(target);
    }

    function _allocateToEcosystemFund(uint256 seigniorage)
        internal
        returns (uint256)
    {
        uint256 ecosystemReserve =
            seigniorage.mul(ecosystemFundAllocationRate).div(100);
        if (ecosystemReserve > 0) {
            ICustomERC20(cash).safeApprove(ecosystemFund, ecosystemReserve);
            ISimpleERCFund(ecosystemFund).deposit(
                cash,
                ecosystemReserve,
                'Treasury: Ecosystem Seigniorage Allocation'
            );
            emit PoolFunded(ecosystemFund, ecosystemReserve);
            return ecosystemReserve;
        }

        return 0;
    }

    /**
     * Updates the cash price from the various oracles.
     * TODO: this function needs to be optimised for gas
     */
    function _updateCashPrice() internal {
        if (Epoch(uniswap1hrOracle).callable()) {
            try IUniswapOracle(uniswap1hrOracle).update() {} catch {}
        }

        if (Epoch(uniswap12hrOracle).callable()) {
            try IUniswapOracle(uniswap12hrOracle).update() {} catch {}
        }

        // TODO: do the same for the gmu oracle as well
        // if (Epoch(seigniorageOracle).callable()) {
        //     try IOracle(seigniorageOracle).update() {} catch {}
        // }

        cashTargetPrice = getGMUOraclePrice();
    }

    /**
     * Helper function to allocate seigniorage to bond token holders. Seigniorage
     * before the boardrooms get paid.
     */
    function _allocateToBondHolders(uint256 seigniorage)
        internal
        returns (uint256)
    {
        uint256 seigniorageToAllocate =
            Math.min(
                seigniorage,
                ICustomERC20(bond).totalSupply().sub(accumulatedSeigniorage())
            );

        if (seigniorageToAllocate > 0) {
            // update accumulated seigniorage
            ICustomERC20(cash).safeApprove(
                bondRedeemptionBoardroom,
                seigniorageToAllocate
            );
            IBoardroom(bondRedeemptionBoardroom).allocateSeigniorage(
                seigniorageToAllocate
            );
            emit TreasuryFunded(now, seigniorageToAllocate);
            return seigniorageToAllocate;
        }

        return 0;
    }

    /**
     * Helper function to allocate seigniorage to boardooms. Seigniorage is allocated
     * after bond token holders have been paid first.
     */
    function _allocateToBoardrooms(uint256 boardroomReserve) internal {
        if (boardroomReserve <= 0) return;

        // Calculate boardroom reserves.
        uint256 arthLiquidityBoardroomReserve =
            boardroomReserve.mul(arthLiquidityBoardroomAllocationRate).div(100);
        uint256 arthBoardroomReserve =
            boardroomReserve.mul(arthBoardroomAllocationRate).div(100);
        uint256 mahaLiquidityBoardroomReserve =
            boardroomReserve.mul(mahaLiquidityBoardroomAllocationRate).div(100);

        if (arthLiquidityBoardroomReserve > 0) {
            ICustomERC20(cash).safeApprove(
                arthLiquidityBoardroom,
                arthLiquidityBoardroomReserve
            );
            IBoardroom(arthLiquidityBoardroom).allocateSeigniorage(
                arthLiquidityBoardroomReserve
            );
            emit PoolFunded(
                arthLiquidityBoardroom,
                arthLiquidityBoardroomReserve
            );
        }

        if (arthBoardroomReserve > 0) {
            ICustomERC20(cash).safeApprove(arthBoardroom, arthBoardroomReserve);
            IBoardroom(arthBoardroom).allocateSeigniorage(arthBoardroomReserve);
            emit PoolFunded(arthBoardroom, arthBoardroomReserve);
        }

        if (mahaLiquidityBoardroomReserve > 0) {
            ICustomERC20(cash).safeApprove(
                mahaLiquidityBoardroom,
                mahaLiquidityBoardroomReserve
            );
            IBoardroom(mahaLiquidityBoardroom).allocateSeigniorage(
                mahaLiquidityBoardroomReserve
            );
            emit PoolFunded(
                mahaLiquidityBoardroom,
                mahaLiquidityBoardroomReserve
            );
        }
    }

    /**
     * This function calculates how much bonds should be minted given an epoch
     * https://github.com/Basis-Cash/basiscash-protocol/issues/27
     *
     * The cap will be of the following size: ($1-1hTWAP)*(Circ $BAC),
     * where 1hTWAP is the 1h TWAP of the $ARTH price and “Circ $ARTH is
     * the Circulating $ARTH supply. The cap will last for one hour; after
     * an hour a new TWAP will be calculated and the cap is reset based on
     * next 12h epoch.
     */
    function _updateConversionLimit(uint256 cash1hPrice) internal {
        // reset this counter so that new bonds can now be minted.
        accumulatedBonds = 0;
        cashToBondConversionLimit = estimateBondsToIssue(cash1hPrice);
    }

    // GOV
    event Initialized(address indexed executor, uint256 at);
    event Migration(address indexed target);
    event RedeemedBonds(address indexed from, uint256 amount, bool sellForDai);
    event BoughtBonds(
        address indexed from,
        uint256 amountDaiIn,
        uint256 amountBurnt,
        uint256 bondsIssued
    );
    event Log(uint256 data);
    event TreasuryFunded(uint256 timestamp, uint256 seigniorage);
    event SeigniorageMinted(uint256 seigniorage);
    event BondsAllocated(uint256 limit);
    event PoolFunded(address indexed pool, uint256 seigniorage);
    event StabilityFeesCharged(address indexed from, uint256 stabilityFeeValue);
    event FundsInitialied(
        // Boardrooms
        address _arthLiquidityBoardroom,
        address _mahaLiquidityBoardroom,
        address _arthBoardroom,
        address _bondRedeemptionBoardroom,
        // The Ecosystem fund
        address _fund,
        // A rainy-day fund.
        address _rainyfund
    );
}

// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import {IERC20} from '@openzeppelin/contracts/contracts/token/ERC20/IERC20.sol';
import {Math} from '@openzeppelin/contracts/contracts/math/Math.sol';
import {ICustomERC20} from '../interfaces/ICustomERC20.sol';
import {IUniswapOracle} from '../interfaces/IUniswapOracle.sol';
import {IUniswapV2Router02} from '../interfaces/IUniswapV2Router02.sol';
import {IBoardroom} from '../interfaces/IBoardroom.sol';
import {ISimpleERCFund} from '../interfaces/ISimpleERCFund.sol';
import {Operator} from '../owner/Operator.sol';
import {Epoch} from '../utils/Epoch.sol';
import {TreasurySetters} from './TreasurySetters.sol';
import {SafeMath} from '@openzeppelin/contracts/contracts/math/SafeMath.sol';

/**
 * @title ARTH Treasury contract
 * @notice Monetary policy logic to adjust supplies of ARTH & ARTHB
 * @author Steven Enamakel & Yash Agrawal. Original code written by Summer Smith & Rick Sanchez
 */
abstract contract TreasuryHelpers is TreasurySetters {
    using SafeMath for uint256;

    modifier updatePrice {
        _;
        _updateCashPrice();
    }

    function migrate(address target) public onlyOperator checkOperator {
        require(target != address(0), 'migrate to zero');
        require(!state.migrated, '!migrated');

        // TODO: check if the destination is a treasury or not

        // cash
        cash.transferOperator(target);
        cash.transferOwnership(target);
        cash.transfer(target, cash.balanceOf(address(this)));

        // bond
        bond.transferOperator(target);
        bond.transferOwnership(target);
        bond.transfer(target, bond.balanceOf(address(this)));

        // share - disabled ownership and operator functions as MAHA tokens don't have these
        share.transfer(target, share.balanceOf(address(this)));

        state.migrated = true;
        emit Migration(target);
    }

    function _allocateToFund(
        ISimpleERCFund fund,
        uint256 rate,
        uint256 seigniorage
    ) internal returns (uint256) {
        uint256 allocation = seigniorage.mul(rate).div(100);
        if (allocation > 0) {
            cash.approve(address(fund), allocation);
            fund.deposit(
                cash,
                allocation,
                'Treasury: Fund Seigniorage Allocation'
            );
            emit PoolFunded(address(fund), allocation);
            return allocation;
        }

        return 0;
    }

    /**
     * Updates the cash price from the various oracles.
     * TODO: this function needs to be optimised for gas
     */
    function _updateCashPrice() internal {
        if (oracleState.bondOracle.callable()) {
            try IUniswapOracle(oracleState.bondOracle).update() {} catch {}
        }

        if (oracleState.seigniorageOracle.callable()) {
            try
                IUniswapOracle(oracleState.seigniorageOracle).update()
            {} catch {}
        }

        // TODO: do the same for the gmu oracle as well
        // if (Epoch(seigniorageOracle).callable()) {
        //     try IOracle(seigniorageOracle).update() {} catch {}
        // }

        state.cashTargetPrice = getGMUOraclePrice();
    }

    /**
     * Helper function to allocate seigniorage to bond token holders. Seigniorage
     * before the boardrooms get paid.
     */
    function _allocateToBondHolders(uint256 seigniorage)
        internal
        returns (uint256)
    {
        uint256 treasuryReserve =
            Math.min(
                seigniorage,
                bond.totalSupply().sub(state.accumulatedSeigniorage)
            );

        if (treasuryReserve > 0) {
            // update accumulated seigniorage
            state.accumulatedSeigniorage = state.accumulatedSeigniorage.add(
                treasuryReserve
            );
            emit TreasuryFunded(block.timestamp, treasuryReserve);
            return treasuryReserve;
        }

        return 0;
    }

    /**
     * Helper function to allocate seigniorage to boardooms. Seigniorage is allocated
     * after bond token holders have been paid first.
     */
    function _allocateToBoardroom(
        IERC20 token,
        IBoardroom boardroom,
        uint256 rate,
        uint256 seigniorage
    ) private {
        // Calculate boardroom reserves.
        uint256 reserve = seigniorage.mul(rate).div(100);

        if (reserve > 0) {
            token.approve(address(boardroom), reserve);
            boardroom.allocateSeigniorage(reserve);
            emit PoolFunded(address(boardroom), reserve);
        }
    }

    function _allocateToBoardrooms(IERC20 token, uint256 boardroomReserve)
        internal
    {
        if (boardroomReserve <= 0) return;
        bool mahaBoardroom = token == share;

        _allocateToBoardroom(
            token,
            mahaBoardroom
                ? boardroomState.mahaArthLiquidityMlpBoardroom
                : boardroomState.arthArthLiquidityMlpBoardroom,
            boardroomState.arthLiquidityMlpAllocationRate,
            boardroomReserve
        );

        _allocateToBoardroom(
            token,
            mahaBoardroom
                ? boardroomState.mahaArthBoardroom
                : boardroomState.arthArthBoardroom,
            boardroomState.arthBoardroomAllocationRate,
            boardroomReserve
        );

        _allocateToBoardroom(
            token,
            mahaBoardroom
                ? boardroomState.mahaMahaBoardroom
                : boardroomState.arthMahaBoardroom,
            boardroomState.mahaLiquidityBoardroomAllocationRate,
            boardroomReserve
        );
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
        state.accumulatedBonds = 0;
        state.cashToBondConversionLimit = estimateBondsToIssue(cash1hPrice);
    }

    // GOV
    event Initialized(address indexed executor, uint256 at);
    event Migration(address indexed target);
    event RedeemedBonds(address indexed from, uint256 amount);
    event BoughtBonds(
        address indexed from,
        uint256 amountDaiIn,
        uint256 amountBurnt,
        uint256 bondsIssued
    );
    event TreasuryFunded(uint256 timestamp, uint256 seigniorage);
    event SeigniorageMinted(uint256 seigniorage);
    event BondsAllocated(uint256 limit);
    event PoolFunded(address indexed pool, uint256 seigniorage);
    event StabilityFeesCharged(address indexed from, uint256 amount);
}

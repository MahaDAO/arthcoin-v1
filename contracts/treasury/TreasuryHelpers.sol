// SPDX-License-Identifier: MIT

pragma solidity ^0.6.10;

import {Math} from '@openzeppelin/contracts/math/Math.sol';
import {SafeERC20} from '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';
import {ICustomERC20} from '../interfaces/ICustomERC20.sol';
import {IUniswapOracle} from '../interfaces/IUniswapOracle.sol';
import {IUniswapV2Router02} from '../interfaces/IUniswapV2Router02.sol';
import {IBoardroom} from '../interfaces/IBoardroom.sol';
import {ISimpleERCFund} from '../interfaces/ISimpleERCFund.sol';
import {Operator} from '../owner/Operator.sol';
import {Epoch} from '../utils/Epoch.sol';
import {TreasurySetters} from './TreasurySetters.sol';

/**
 * @title ARTH Treasury contract
 * @notice Monetary policy logic to adjust supplies of basis cash assets
 * @author Steven Enamakel & Yash Agrawal. Original code written by Summer Smith & Rick Sanchez
 */
abstract contract TreasuryHelpers is TreasurySetters {
    using SafeERC20 for ICustomERC20;

    modifier updatePrice {
        _;
        _updateCashPrice();
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

    function _allocateToFund(
        address fund,
        uint256 rate,
        uint256 seigniorage
    ) internal returns (uint256) {
        uint256 allocation = seigniorage.mul(rate).div(100);
        if (allocation > 0) {
            ICustomERC20(cash).safeApprove(fund, allocation);
            ISimpleERCFund(fund).deposit(
                cash,
                allocation,
                'Treasury: Fund Seigniorage Allocation'
            );
            emit PoolFunded(fund, allocation);
            return allocation;
        }

        return 0;
    }

    /**
     * Updates the cash price from the various oracles.
     * TODO: this function needs to be optimised for gas
     */
    function _updateCashPrice() internal {
        if (Epoch(bondOracle).callable()) {
            try IUniswapOracle(bondOracle).update() {} catch {}
        }

        if (Epoch(seigniorageOracle).callable()) {
            try IUniswapOracle(seigniorageOracle).update() {} catch {}
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
        uint256 treasuryReserve =
            Math.min(
                seigniorage,
                ICustomERC20(bond).totalSupply().sub(accumulatedSeigniorage)
            );

        if (treasuryReserve > 0) {
            // update accumulated seigniorage
            accumulatedSeigniorage = accumulatedSeigniorage.add(
                treasuryReserve
            );
            emit TreasuryFunded(now, treasuryReserve);
            return treasuryReserve;
        }

        return 0;
    }

    /**
     * Helper function to allocate seigniorage to boardooms. Seigniorage is allocated
     * after bond token holders have been paid first.
     */
    function _allocateToBoardroom(
        address token,
        address boardroom,
        uint256 rate,
        uint256 seigniorage
    ) private {
        if (seigniorage == 0) return;

        // Calculate boardroom reserves.
        uint256 reserve = seigniorage.mul(rate).div(100);

        // arth-dai uniswap lp
        if (reserve > 0) {
            ICustomERC20(token).approve(boardroom, reserve);
            IBoardroom(boardroom).allocateSeigniorage(reserve);
            emit PoolFunded(boardroom, reserve);
        }
    }

    function _allocateSeignorageToBoardrooms(uint256 boardroomReserve)
        internal
    {
        if (boardroomReserve <= 0) return;
        _allocateToBoardroom(
            cash,
            arthArthLiquidityMlpBoardroom,
            arthLiquidityMlpAllocationRate,
            boardroomReserve
        );

        _allocateToBoardroom(
            cash,
            arthArthBoardroom,
            arthBoardroomAllocationRate,
            boardroomReserve
        );

        _allocateToBoardroom(
            cash,
            arthMahaBoardroom,
            mahaLiquidityBoardroomAllocationRate,
            boardroomReserve
        );
    }

    function _allocateContractionRewardToBoardrooms(uint256 boardroomReserve)
        internal
    {
        if (boardroomReserve <= 0) return;

        _allocateToBoardroom(
            share,
            mahaArthLiquidityMlpBoardroom,
            arthLiquidityMlpAllocationRate,
            boardroomReserve
        );

        _allocateToBoardroom(
            share,
            mahaArthBoardroom,
            arthBoardroomAllocationRate,
            boardroomReserve
        );

        _allocateToBoardroom(
            share,
            mahaMahaBoardroom,
            mahaLiquidityBoardroomAllocationRate,
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
        accumulatedBonds = 0;
        cashToBondConversionLimit = estimateBondsToIssue(cash1hPrice);
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

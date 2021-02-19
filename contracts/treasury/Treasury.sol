// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import {IBasisAsset} from '../interfaces/IBasisAsset.sol';
import {IBoardroom} from '../interfaces/IBoardroom.sol';
import {IERC20} from '@openzeppelin/contracts/contracts/token/ERC20/IERC20.sol';
import {ISimpleERCFund} from '../interfaces/ISimpleERCFund.sol';
import {ISimpleOracle} from '../interfaces/ISimpleOracle.sol';
import {IUniswapOracle} from '../interfaces/IUniswapOracle.sol';
import {Math} from '@openzeppelin/contracts/contracts/math/Math.sol';
import {SafeMath} from '@openzeppelin/contracts/contracts/math/SafeMath.sol';
import {TreasurySetters} from './TreasurySetters.sol';
import {TreasuryState} from './TreasuryState.sol';
import {Maharaja} from '../Maharaja.sol';

/**
 * @title ARTH Treasury contract
 * @notice Monetary policy logic to adjust supplies of basis cash assets
 * @author Steven Enamakel & Yash Agrawal. Original code written by Summer Smith & Rick Sanchez
 */
contract Treasury is TreasurySetters {
    using SafeMath for uint256;

    constructor(
        Maharaja _maharaja,
        IERC20 _dai,
        IBasisAsset _cash,
        IBasisAsset _bond,
        IERC20 _share,
        uint256 _startTime,
        uint256 _period,
        uint256 _startEpoch
    ) TreasuryState(_startTime, _period, _startEpoch) {
        // Cash and bond token operator.
        maharaja = _maharaja;

        // Tokens.
        dai = _dai;
        cash = _cash;
        bond = _bond;
        share = _share;
    }

    modifier updatePrice {
        _;
        _updateCashPrice();
    }

    function initialize() external validateOperator {
        require(!flags.initialized, '!initialized');

        // Set accumulatedSeigniorage to the treasury's balance.
        state.accumulatedSeigniorage = IERC20(cash).balanceOf(address(this));

        flags.initialized = true;
        emit Initialized(msg.sender, block.number);
    }

    function buyBonds(uint256 amountInDai, uint256 targetPrice)
        external
        onlyOneBlock
        checkMigration
        checkStartTime
        validateOperator
        updatePrice
        returns (uint256)
    {
        require(amountInDai > 0, 'zero amount');

        // Update the price to latest before using.
        uint256 cash1hPrice = get1hrTWAPOraclePrice();

        require(cash1hPrice <= targetPrice, 'cash price moved');
        require(
            cash1hPrice <= getBondPurchasePrice(), // price < $0.95
            'cash price not eligible'
        );
        require(state.cashToBondConversionLimit > 0, 'no more bonds');

        // Find the expected amount recieved when swapping the following
        // tokens on uniswap.
        address[] memory path = new address[](2);
        path[0] = address(dai);
        path[1] = address(cash);

        uint256[] memory amountsOut =
            state.uniswapRouter.getAmountsOut(amountInDai, path);
        uint256 expectedCashAmount = amountsOut[1];

        // 1. Take Dai from the user
        dai.transferFrom(msg.sender, address(this), amountInDai);

        // 2. Approve dai for trade on uniswap
        dai.approve(address(state.uniswapRouter), amountInDai);

        // 3. Swap dai for ARTH from uniswap and send the ARTH to the sender
        // we send the ARTH back to the sender just in case there is some slippage
        // in our calculations and we end up with more ARTH than what is needed.
        uint256[] memory output =
            state.uniswapRouter.swapExactTokensForTokens(
                amountInDai,
                expectedCashAmount,
                path,
                msg.sender,
                block.timestamp
            );

        // set approve to 0 after transfer
        dai.approve(address(state.uniswapRouter), 0);

        // we do this to understand how much ARTH was bought back as without this, we
        // could witness a flash loan attack. (given that the minted amount of ARTHB
        // minted is based how much ARTH was received)
        uint256 boughtBackCash = Math.min(output[1], expectedCashAmount);

        // basis the amount of ARTH being bought back; understand how much of it
        // can we convert to bond tokens by looking at the conversion limits
        uint256 cashToConvert =
            Math.min(
                boughtBackCash,
                state.cashToBondConversionLimit.sub(state.accumulatedBonds)
            );

        // if all good then mint ARTHB, burn ARTH and update the counters
        require(cashToConvert > 0, 'no more bond limit');

        uint256 bondsToIssue =
            cashToConvert.mul(uint256(100).add(state.bondDiscount)).div(100);
        state.accumulatedBonds = state.accumulatedBonds.add(bondsToIssue);

        // 3. Burn bought ARTH cash and mint bonds at the discounted price.
        // TODO: Set the minting amount according to bond price.
        // TODO: calculate premium basis size of the trade
        maharaja.burnCash(msg.sender, cashToConvert);
        maharaja.mintBond(msg.sender, bondsToIssue);

        emit BoughtBonds(msg.sender, amountInDai, cashToConvert, bondsToIssue);

        return bondsToIssue;
    }

    /**
     * Redeeming bonds happen when
     */
    function redeemBonds(uint256 amount)
        external
        onlyOneBlock
        checkMigration
        checkStartTime
        validateOperator
        updatePrice
    {
        require(amount > 0, 'zero amount');
        require(
            get1hrTWAPOraclePrice() > getBondRedemtionPrice(), // price > $1.00
            'cashPrice less than ceiling'
        );
        require(
            cash.balanceOf(address(this)) >= amount,
            'treasury has not enough budget'
        );

        amount = Math.min(state.accumulatedSeigniorage, amount);

        // hand over the ARTH directly
        state.accumulatedSeigniorage = state.accumulatedSeigniorage.sub(amount);
        maharaja.burnBond(msg.sender, amount);
        cash.transfer(msg.sender, amount);

        emit RedeemedBonds(msg.sender, amount);
    }

    function allocateSeigniorage()
        external
        onlyOneBlock
        checkMigration
        checkStartTime
        checkEpoch
        validateOperator
    {
        emit AdvanceEpoch(msg.sender);

        _updateCashPrice();
        uint256 cash12hPrice = get12hrTWAPOraclePrice();

        // send 300 ARTH reward to the person advancing the epoch to compensate for gas
        maharaja.mintCash(msg.sender, uint256(300).mul(1e18));

        // update the bond limits
        _updateConversionLimit(cash12hPrice);

        // Check if we are below the peg. < $1.00
        if (cash12hPrice <= state.cashTargetPrice) {
            // Check if we are below the peg and in contraction or not.
            // Should we use bond purchase price or target price?
            uint256 contractionRewardToGive =
                Math.min(
                    state.contractionRewardPerEpoch,
                    share.balanceOf(address(this))
                );

            // Allocate the appropriate contraction reward to boardrooms.
            _allocateToBoardrooms(share, contractionRewardToGive);

            return;
        }

        // < $1.05
        if (cash12hPrice <= getExpansionLimitPrice()) {
            // if we are below the ceiling price (or expansion limit price) but
            // above the target price, then we try to pay off all the bond holders
            // as much as possible.

            // calculate how much seigniorage should be minted basis deviation from target price
            uint256 seigniorage1 = estimateSeignorageToMint(cash12hPrice);

            // if we don't have to pay bond holders anything then simply return.
            if (seigniorage1 == 0) return;

            // we have to pay them some amount; so mint, distribute and return
            maharaja.mintCash(address(this), seigniorage1);
            emit SeigniorageMinted(seigniorage1);

            if (flags.enableSurprise) {
                // surprise!! send 10% to boardooms and 90% to bond holders
                _allocateToBondHolders(seigniorage1.mul(90).div(100));
                _allocateToBoardrooms(cash, seigniorage1.mul(10).div(100));
            } else {
                _allocateToBondHolders(seigniorage1);
            }

            return;
        }

        // > $1.05
        uint256 seigniorage = estimateSeignorageToMint(cash12hPrice);
        if (seigniorage == 0) return;

        maharaja.mintCash(address(this), seigniorage);
        emit SeigniorageMinted(seigniorage);

        // send funds to the ecosystem development and rainy day fund
        uint256 ecosystemReserve =
            _allocateToFund(
                boardroomState.ecosystemFund,
                boardroomState.ecosystemFundAllocationRate,
                seigniorage
            );

        uint256 raindayReserve =
            _allocateToFund(
                boardroomState.rainyDayFund,
                boardroomState.rainyDayFundAllocationRate,
                seigniorage
            );

        seigniorage = seigniorage.sub(ecosystemReserve).sub(raindayReserve);

        // keep 90% of the funds to bond token holders; and send the remaining to the boardroom
        uint256 allocatedForBondHolders =
            seigniorage.mul(state.bondSeigniorageRate).div(100);
        uint256 treasuryReserve =
            _allocateToBondHolders(allocatedForBondHolders);
        seigniorage = seigniorage.sub(treasuryReserve);

        // allocate everything else to the boardroom
        _allocateToBoardrooms(cash, seigniorage);
    }

    function refundShares() external onlyOwner {
        share.transfer(msg.sender, share.balanceOf(address(this)));
    }

    function migrate(address target) external validateOperator {
        require(target != address(0), 'migrate to zero');
        require(!flags.migrated, '!migrated');

        // cash
        cash.transfer(target, cash.balanceOf(address(this)));
        bond.transfer(target, bond.balanceOf(address(this)));
        share.transfer(target, share.balanceOf(address(this)));

        flags.migrated = true;
        emit Migration(target);
    }

    function _allocateToFund(
        ISimpleERCFund fund,
        uint256 rate,
        uint256 seigniorage
    ) private returns (uint256) {
        uint256 allocation = seigniorage.mul(rate).div(100);
        if (allocation > 0) {
            cash.approve(address(fund), allocation);
            fund.deposit(cash, allocation, 'Treasury: Fund Allocation');
            emit PoolFunded(address(fund), allocation);
            return allocation;
        }

        return 0;
    }

    /**
     * Updates the cash price from the various oracles.
     * TODO: this function needs to be optimised for gas
     */
    function _updateCashPrice() private {
        if (oracleState.oracle1hrTWAP.callable()) {
            try IUniswapOracle(oracleState.oracle1hrTWAP).update() {} catch {}
        }

        if (oracleState.oracle12hrTWAP.callable()) {
            try IUniswapOracle(oracleState.oracle12hrTWAP).update() {} catch {}
        }

        // TODO: do the same for the gmu oracle as well
        // if (Epoch(oracle12hrTWAP).callable()) {
        //     try IOracle(oracle12hrTWAP).update() {} catch {}
        // }

        state.cashTargetPrice = getGMUOraclePrice();
    }

    /**
     * Helper function to allocate seigniorage to bond token holders. Seigniorage
     * before the boardrooms get paid.
     */
    function _allocateToBondHolders(uint256 seigniorage)
        private
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
        private
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
            boardroomState.arthAllocationRate,
            boardroomReserve
        );

        _allocateToBoardroom(
            token,
            mahaBoardroom
                ? boardroomState.mahaMahaBoardroom
                : boardroomState.arthMahaBoardroom,
            boardroomState.mahaAllocationRate,
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
    function _updateConversionLimit(uint256 cash1hPrice) private {
        // reset this counter so that new bonds can now be minted.
        state.accumulatedBonds = 0;
        state.cashToBondConversionLimit = estimateBondsToIssue(cash1hPrice);
    }

    // events
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

    event AdvanceEpoch(address indexed from);
}

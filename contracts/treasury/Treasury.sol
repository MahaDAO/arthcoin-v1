// SPDX-License-Identifier: MIT

pragma solidity ^0.6.0;

import '@openzeppelin/contracts/math/Math.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';
import '@openzeppelin/contracts/utils/ReentrancyGuard.sol';
import '@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol';

import '../interfaces/IOracle.sol';
import '../interfaces/IBoardroom.sol';
import '../interfaces/IBasisAsset.sol';
import '../interfaces/ISimpleERCFund.sol';
import '../lib/Babylonian.sol';
import '../lib/FixedPoint.sol';
import '../lib/Safe112.sol';
import '../owner/Operator.sol';
import '../utils/Epoch.sol';
import '../utils/ContractGuard.sol';
import '../interfaces/IGMUOracle.sol';
import './TreasurySetters.sol';

/**
 * @title ARTH Treasury contract
 * @notice Monetary policy logic to adjust supplies of basis cash assets
 * @author Steven Enamakel & Yash Agarwal. Original code written by Summer Smith & Rick Sanchez
 */
contract Treasury is TreasurySetters {
    constructor(
        address _dai,
        address _cash,
        address _bond,
        address _share,
        address _bondOracle,
        address _mahausdOracle,
        address _seigniorageOracle,
        address _arthLiquidityBoardroom,
        address _arthBoardroom,
        address _fund,
        address _uniswapRouter,
        address _gmuOracle,
        uint256 _startTime,
        uint256 _period
    ) public Epoch(_period, _startTime, 0) {
        // tokens
        dai = _dai;
        cash = _cash;
        bond = _bond;
        share = _share;

        // oracles
        bondOracle = _bondOracle;
        mahausdOracle = _mahausdOracle;
        seigniorageOracle = _seigniorageOracle;
        gmuOracle = _gmuOracle;

        // funds
        arthLiquidityBoardroom = _arthLiquidityBoardroom;
        arthBoardroom = _arthBoardroom;
        ecosystemFund = _fund;

        uniswapRouter = _uniswapRouter;

        _updateCashPrice();
    }

    /* ========== GOVERNANCE ========== */

    function initialize() public checkOperator {
        require(!initialized, 'Treasury: initialized');

        // set accumulatedSeigniorage to it's balance
        accumulatedSeigniorage = IERC20(cash).balanceOf(address(this));

        initialized = true;
        emit Initialized(msg.sender, block.number);
    }

    function migrate(address target) public onlyOperator checkOperator {
        require(!migrated, 'Treasury: migrated');

        // cash
        Operator(cash).transferOperator(target);
        Operator(cash).transferOwnership(target);
        IERC20(cash).transfer(target, IERC20(cash).balanceOf(address(this)));

        // bond
        Operator(bond).transferOperator(target);
        Operator(bond).transferOwnership(target);
        IERC20(bond).transfer(target, IERC20(bond).balanceOf(address(this)));

        // share - disabled ownership and operator functions as MAHA tokens don't have these
        IERC20(share).transfer(target, IERC20(share).balanceOf(address(this)));

        migrated = true;
        emit Migration(target);
    }

    function buyBonds(uint256 amountInDai, uint256 targetPrice)
        external
        onlyOneBlock
        checkMigration
        checkStartTime
        checkOperator
        returns (uint256)
    {
        require(
            amountInDai > 0,
            'Treasury: cannot purchase bonds with zero amount'
        );

        // Update the price to latest before using.
        uint256 bondPrice = _getCashPrice(bondOracle);

        require(bondPrice == targetPrice, 'Treasury: cash price moved');
        require(
            bondPrice < cashTargetPrice, // price < $1
            'Treasury: cashPrice not eligible for bond purchase'
        );

        // Find the expected amount recieved when swapping the following
        // tokens on uniswap.
        address[] memory path = new address[](2);
        path[0] = address(dai);
        path[1] = address(cash);

        uint256[] memory amountsOut =
            IUniswapV2Router02(uniswapRouter).getAmountsOut(amountInDai, path);
        uint256 expectedCashAmount = amountsOut[1];

        // 1. Take Dai from the user
        IERC20(dai).safeTransferFrom(msg.sender, address(this), amountInDai);

        // 2. Approve dai for trade on uniswap
        IERC20(dai).safeApprove(uniswapRouter, amountInDai);

        // 2. Swap dai for ARTH from uniswap and send the ARTH to the sender
        // we send the ARTH back to the sender just in case there is some slippage
        // in our calculations and we end up with more ARTH than what is needed.
        uint256[] memory output =
            IUniswapV2Router02(uniswapRouter).swapExactTokensForTokens(
                amountInDai,
                expectedCashAmount,
                path,
                msg.sender,
                block.timestamp
            );

        // we understand how much ARTH was bought back as without this, we
        // could witness a flash loan attack. (given that the minted amount of ARTHB
        // minted is based how much ARTH was received)
        uint256 boughtBackARTH = Math.min(output[1], expectedCashAmount);

        // 3. Burn bought ARTH cash and mint bonds at the discounted price.
        // TODO: Set the minting amount according to bond price.
        // TODO: calculate premium basis size of the trade
        IBasisAsset(cash).burnFrom(msg.sender, boughtBackARTH);
        IBasisAsset(bond).mint(
            msg.sender,
            boughtBackARTH.mul(100).div(bondDiscountOutOf100)
        );

        _updateCashPrice();
        emit BoughtBonds(msg.sender, boughtBackARTH);
        return boughtBackARTH;
    }

    /**
     * Redeeming bonds happen when
     */
    function redeemBonds(
        uint256 amount,
        uint256 targetPrice,
        bool sellForDai
    ) external onlyOneBlock checkMigration checkStartTime checkOperator {
        require(amount > 0, 'Treasury: cannot redeem bonds with zero amount');

        uint256 cashPrice = _getCashPrice(bondOracle);
        require(cashPrice == targetPrice, 'Treasury: cash price has moved');
        require(
            cashPrice > cashPriceCeiling, // price > $1.05
            'Treasury: cashPrice less than ceiling'
        );
        require(
            IERC20(cash).balanceOf(address(this)) >= amount,
            'Treasury: treasury has not enough budget'
        );

        accumulatedSeigniorage = accumulatedSeigniorage.sub(
            Math.min(accumulatedSeigniorage, amount)
        );

        uint256 stabilityFeeAmount = amount.mul(stabilityFee).div(100);
        uint256 stabilityFeeValue =
            IOracle(mahausdOracle).consult(share, stabilityFeeAmount);

        // charge the stability fee
        IERC20(share).safeTransferFrom(
            msg.sender,
            address(this),
            stabilityFeeValue
        );

        IBasisAsset(bond).burnFrom(msg.sender, amount);

        // sell the ARTH for Dai right away
        if (sellForDai) {
            IERC20(cash).safeTransfer(address(this), amount);

            address[] memory path = new address[](2);
            path[0] = address(cash);
            path[1] = address(dai);

            uint256[] memory amountsOut =
                IUniswapV2Router02(uniswapRouter).getAmountsOut(amount, path);
            uint256 expectedDaiAmount = amountsOut[1];

            IERC20(cash).safeApprove(uniswapRouter, amount);
            IUniswapV2Router02(uniswapRouter).swapExactTokensForTokens(
                amount,
                expectedDaiAmount,
                path,
                msg.sender,
                block.timestamp
            );
        } else {
            // or just hand over the ARTH directly
            IERC20(cash).safeTransfer(msg.sender, amount);
        }

        _updateCashPrice();
        emit RedeemedBonds(msg.sender, amount);
    }

    function allocateSeigniorage()
        external
        onlyOneBlock
        checkMigration
        checkStartTime
        checkEpoch
        checkOperator
    {
        _updateCashPrice();
        uint256 cashPrice = _getCashPrice(seigniorageOracle);

        // send 1000 ARTH reward to the person advancing the epoch to compensate for gas
        IBasisAsset(cash).mint(msg.sender, uint256(1000).mul(1e18));

        if (cashPrice <= cashPriceCeiling) {
            // TODO: allocate bonds budget over here
            return; // just advance epoch instead revert
        }

        // circulating supply
        uint256 cashSupply =
            IERC20(cash).totalSupply().sub(accumulatedSeigniorage);

        uint256 percentage = cashPrice.sub(cashTargetPrice);
        uint256 seigniorage = cashSupply.mul(percentage).div(1e18);
        IBasisAsset(cash).mint(address(this), seigniorage);

        // send funds to the community development fund
        uint256 ecosystemReserve = _allocateToEcosystemFund(seigniorage);
        seigniorage = seigniorage.sub(ecosystemReserve);

        // keep 90% of the funds to bond token holders; and send the remaining to the boardroom
        uint256 allocatedForTreasury = seigniorage.mul(90).div(100);
        uint256 treasuryReserve = _allocateToBondHolers(allocatedForTreasury);
        seigniorage = seigniorage.sub(treasuryReserve);

        // allocate everything else to the boardroom
        _allocateToBoardrooms(seigniorage);
    }

    function _allocateToEcosystemFund(uint256 seigniorage)
        internal
        returns (uint256)
    {
        uint256 ecosystemReserve =
            seigniorage.mul(ecosystemFundAllocationRate).div(100);
        if (ecosystemReserve > 0) {
            IERC20(cash).safeApprove(ecosystemFund, ecosystemReserve);
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
        try IOracle(bondOracle).update() {} catch {}
        try IOracle(seigniorageOracle).update() {} catch {}

        cashTargetPrice = IGMUOracle(gmuOracle).getPrice();

        // Set the ceiling price to be 5% above the target price.
        cashPriceCeiling =
            cashTargetPrice +
            uint256(5).mul(cashTargetPrice).div(10**2);

        bondDepletionFloor = uint256(1000).mul(cashTargetPrice);
    }

    /**
     * Helper function to allocate seigniorage to bond token holders. Seigniorage
     * before the boardrooms get paid.
     */
    function _allocateToBondHolers(uint256 seigniorage)
        internal
        returns (uint256)
    {
        uint256 treasuryReserve =
            Math.min(
                seigniorage,
                IERC20(bond).totalSupply().sub(accumulatedSeigniorage)
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
    function _allocateToBoardrooms(uint256 boardroomReserve) internal {
        if (boardroomReserve <= 0) return;

        // Calculate boardroom reserves.
        uint256 arthLiquidityBoardroomReserve =
            boardroomReserve.mul(arthLiquidityBoardroomAllocationRate).div(100);
        uint256 arthBoardroomReserve =
            boardroomReserve.mul(arthBoardroomAllocationRate).div(100);

        if (arthLiquidityBoardroomReserve > 0) {
            IERC20(cash).safeApprove(
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
            IERC20(cash).safeApprove(arthBoardroom, arthBoardroomReserve);
            IBoardroom(arthBoardroom).allocateSeigniorage(arthBoardroomReserve);
            emit PoolFunded(arthBoardroom, arthBoardroomReserve);
        }
    }

    // GOV
    event Initialized(address indexed executor, uint256 at);
    event Migration(address indexed target);
    event RedeemedBonds(address indexed from, uint256 amount);
    event BoughtBonds(address indexed from, uint256 amount);
    event TreasuryFunded(uint256 timestamp, uint256 seigniorage);
    event PoolFunded(address indexed pool, uint256 seigniorage);
}

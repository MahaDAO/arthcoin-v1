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

/**
 * @title Basis ARTH Treasury contract
 * @notice Monetary policy logic to adjust supplies of basis cash assets
 * @author Summer Smith & Rick Sanchez
 */
contract Treasury is ContractGuard, Epoch {
    using FixedPoint for *;
    using SafeERC20 for IERC20;
    using Address for address;
    using SafeMath for uint256;
    using Safe112 for uint112;

    /* ========== STATE VARIABLES ========== */

    // ========== FLAGS
    bool public migrated = false;
    bool public initialized = false;

    // ========== CORE
    address public dai;
    address public cash;
    address public bond;
    address public share;
    address public gmuOracle;
    address public mahausdOracle;
    address public uniswapRouter;

    address public arthLiquidityBoardroom;
    address public arthBoardroom;
    address public ecosystemFund;

    address public bondOracle;
    address public seigniorageOracle;

    // ========== PARAMS
    uint256 public initialCashPriceOne = 1;
    uint256 public cashPriceCeiling;
    uint256 public cashTargetPrice = 1;
    uint256 public bondDepletionFloor;
    uint256 public accumulatedSeigniorage = 0;

    uint256 public bondPremiumOutOf100 = 25;

    uint256 public ecosystemFundAllocationRate = 2;
    uint256 public arthLiquidityBoardroomAllocationRate = 40; // In %.
    uint256 public arthBoardroomAllocationRate = 60; // IN %.
    uint256 public stabilityFee = 1; // IN %;

    /* ========== CONSTRUCTOR ========== */

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
        dai = _dai;
        cash = _cash;
        bond = _bond;
        share = _share;
        bondOracle = _bondOracle;
        mahausdOracle = _mahausdOracle;
        seigniorageOracle = _seigniorageOracle;
        gmuOracle = _gmuOracle;
        arthLiquidityBoardroom = _arthLiquidityBoardroom;
        arthBoardroom = _arthBoardroom;
        ecosystemFund = _fund;
        uniswapRouter = _uniswapRouter;

        cashTargetPrice = IGMUOracle(gmuOracle).getPrice();
        initialCashPriceOne = cashTargetPrice;

        // Set the ceiling price to be 5% above the inital price.
        cashPriceCeiling =
            initialCashPriceOne +
            uint256(5).mul(initialCashPriceOne).div(10**2);

        bondDepletionFloor = uint256(1000).mul(initialCashPriceOne);
    }

    /* =================== Modifier =================== */

    modifier checkMigration {
        require(!migrated, 'Treasury: migrated');
        _;
    }

    modifier checkOperator {
        require(
            IBasisAsset(cash).operator() == address(this) &&
                IBasisAsset(bond).operator() == address(this) &&
                Operator(arthLiquidityBoardroom).operator() == address(this) &&
                Operator(arthBoardroom).operator() == address(this),
            'Treasury: need more permission'
        );
        _;
    }

    function setStabilityFee(uint256 _stabilityFee) public onlyOwner {
        require(_stabilityFee > 0, 'Treasury: fee < 0');
        require(_stabilityFee < 100, 'Treasury: fee >= 0');
        stabilityFee = _stabilityFee;

        emit StabilityFeeChanged(stabilityFee, _stabilityFee);
    }

    function setFund(address newFund, uint256 rate) public onlyOwner {
        ecosystemFund = newFund;
        ecosystemFundAllocationRate = rate;

        emit ContributionPoolChanged(newFund, rate);
    }

    function setArthBoardroom(address newFund, uint256 rate) public onlyOwner {
        require(rate + arthLiquidityBoardroomAllocationRate == 100);

        arthBoardroom = newFund;
        arthBoardroomAllocationRate = rate;

        emit ArthBoardroomChanged(newFund, rate);
    }

    function setArthLiquidityBoardroom(address newFund, uint256 rate)
        public
        onlyOwner
    {
        require(rate + arthBoardroomAllocationRate == 100);

        arthLiquidityBoardroom = newFund;
        arthLiquidityBoardroomAllocationRate = rate;

        emit ArthLiquidityBoardroomChanged(newFund, rate);
    }

    /* ========== VIEW FUNCTIONS ========== */
    function getReserve() public view returns (uint256) {
        return accumulatedSeigniorage;
    }

    function getStabilityFee() public view returns (uint256) {
        return stabilityFee;
    }

    function getCashPriceCeiling() public view returns (uint256) {
        return cashTargetPrice + uint256(5).mul(cashTargetPrice).div(10**2);
    }

    // oracle
    function getBondOraclePrice() public view returns (uint256) {
        return _getCashPrice(bondOracle);
    }

    function getGMUOraclePrice() public view returns (uint256) {
        return IGMUOracle(gmuOracle).getPrice();
    }

    function getSeigniorageOraclePrice() public view returns (uint256) {
        return _getCashPrice(seigniorageOracle);
    }

    function _getCashPrice(address oracle) internal view returns (uint256) {
        try IOracle(oracle).consult(cash, 1e18) returns (uint256 price) {
            return price;
        } catch {
            revert('Treasury: failed to consult cash price from the oracle');
        }
    }

    /* ========== GOVERNANCE ========== */

    function initialize() public checkOperator {
        require(!initialized, 'Treasury: initialized');

        // burn all of it's balance
        IBasisAsset(cash).burn(IERC20(cash).balanceOf(address(this)));

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
        // Operator(share).transferOperator(target);
        // Operator(share).transferOwnership(target);
        IERC20(share).transfer(target, IERC20(share).balanceOf(address(this)));

        // do for boardrooms now
        // Operator(arthLiquidityBoardroom).transferOperator(target);
        // Operator(arthBoardroom).transferOwnership(target);

        migrated = true;
        emit Migration(target);
    }

    /* ========== MUTABLE FUNCTIONS ========== */

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
        _updateCashPrice();
        uint256 bondPrice = _getCashPrice(bondOracle);

        require(bondPrice == targetPrice, 'Treasury: cash price moved');
        require(
            bondPrice < cashTargetPrice, // price < $1
            'Treasury: cashPrice not eligible for bond purchase'
        );

        // Eg. Let's say 1 dai(d) = 10 usd and 1 cash(c) = 20 usd.
        // Then taking c/d = 20/10 = 2.
        // Then c = 2d.
        // Then say x amount of dai is 2 * x amount of cash. Where 2 is c/d
        address[] memory path = new address[](2);
        path[0] = address(dai);
        path[1] = address(cash);

        uint256[] memory amountsOut =
            IUniswapV2Router02(uniswapRouter).getAmountsOut(amountInDai, path);
        uint256 expectedCashAmount = amountsOut[1];

        // do some checks

        // 1. Transfer Dai
        IERC20(dai).transferFrom(msg.sender, address(this), amountInDai);
        IERC20(dai).approve(uniswapRouter, amountInDai);

        // 2. swap dai for ARTH from uniswap
        uint256[] memory output =
            IUniswapV2Router02(uniswapRouter).swapExactTokensForTokens(
                amountInDai,
                expectedCashAmount,
                path,
                msg.sender,
                block.timestamp
            );

        // 3. Burn bought back cash and mint bonds.
        // TODO: Set the minting amount according to bond price.
        // TODO: calculate premium basis size of the trade
        uint256 boughtBackARTH = Math.min(output[1], expectedCashAmount);
        IBasisAsset(cash).burnFrom(msg.sender, boughtBackARTH);
        IBasisAsset(bond).mint(msg.sender, boughtBackARTH);

        emit BoughtBonds(msg.sender, boughtBackARTH);
        return boughtBackARTH;
    }

    function redeemBonds(
        uint256 amount,
        uint256 targetPrice,
        bool sellForDai
    ) external onlyOneBlock checkMigration checkStartTime checkOperator {
        require(amount > 0, 'Treasury: cannot redeem bonds with zero amount');

        _updateCashPrice();
        uint256 cashPrice = _getCashPrice(bondOracle);
        require(cashPrice == targetPrice, 'Treasury: cash price moved');
        require(
            cashPrice > cashPriceCeiling, // price > $1.05
            'Treasury: cashPrice not eligible for bond purchase'
        );
        require(
            IERC20(cash).balanceOf(address(this)) >= amount,
            'Treasury: treasury has no more budget'
        );

        accumulatedSeigniorage = accumulatedSeigniorage.sub(
            Math.min(accumulatedSeigniorage, amount)
        );

        uint256 stabilityFeeAmount = amount.mul(stabilityFee).div(100);
        uint256 stabilityFeeValue =
            IOracle(mahausdOracle).consult(share, stabilityFeeAmount);

        // check balances
        require(
            IERC20(share).balanceOf(msg.sender) >= stabilityFeeValue,
            'Treasury: not enough MAHA balance'
        );
        require(
            IERC20(share).allowance(msg.sender, address(this)) >=
                stabilityFeeValue,
            'Treasury: not enough MAHA allowance'
        );

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
            emit ContributionPoolFunded(now, ecosystemReserve);
            return ecosystemReserve;
        }

        return 0;
    }

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
            emit BoardroomFunded(now, arthLiquidityBoardroomReserve);
        }

        if (arthBoardroomReserve > 0) {
            IERC20(cash).safeApprove(arthBoardroom, arthBoardroomReserve);
            IBoardroom(arthBoardroom).allocateSeigniorage(arthBoardroomReserve);
            emit BoardroomFunded(now, arthBoardroomReserve);
        }
    }

    // GOV
    event Initialized(address indexed executor, uint256 at);
    event Migration(address indexed target);
    event ContributionPoolChanged(address newFund, uint256 newRate);
    event ArthBoardroomChanged(address newFund, uint256 newRate);
    event ArthLiquidityBoardroomChanged(address newFund, uint256 newRate);

    // CORE
    event RedeemedBonds(address indexed from, uint256 amount);
    event BoughtBonds(address indexed from, uint256 amount);
    event TreasuryFunded(uint256 timestamp, uint256 seigniorage);
    event BoardroomFunded(uint256 timestamp, uint256 seigniorage);
    event ContributionPoolFunded(uint256 timestamp, uint256 seigniorage);
    event StabilityFeeChanged(uint256 old, uint256 newRate);
}

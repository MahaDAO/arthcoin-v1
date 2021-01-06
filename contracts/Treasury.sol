// SPDX-License-Identifier: MIT

pragma solidity ^0.6.0;

import '@openzeppelin/contracts/math/Math.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';
import '@openzeppelin/contracts/utils/ReentrancyGuard.sol';

import './interfaces/IOracle.sol';
import './interfaces/IBoardroom.sol';
import './interfaces/IBasisAsset.sol';
import './interfaces/ISimpleERCFund.sol';
import './lib/Babylonian.sol';
import './lib/FixedPoint.sol';
import './lib/Safe112.sol';
import './owner/Operator.sol';
import './utils/Epoch.sol';
import './utils/ContractGuard.sol';
import './interfaces/IGMUOracle.sol';

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
    address public cash;
    address public bond;
    address public share;
    address public gmuOracle;

    address public arthLiquidityBoardroom;
    address public arthBoardroom;
    address public burnbackFund;
    address public developmentFund;

    address public bondOracle;
    address public seigniorageOracle;

    // ========== PARAMS
    uint256 public initialCashPriceOne;
    uint256 public cashPriceCeiling;
    uint256 public cashTargetPrice;
    uint256 public bondDepletionFloor;
    uint256 public accumulatedSeigniorage = 0;

    uint256 public fundAllocationRate = 2;
    uint256 public burnbackAllocationRate = 5;
    uint256 public arthLiquidityBoardroomAllocationRate = 20; // In %.
    uint256 public arthBoardroomAllocationRate = 80; // IN %.
    uint256 public stabilityFee = 1; // IN %;

    /* ========== CONSTRUCTOR ========== */

    constructor(
        address _cash,
        address _bond,
        address _share,
        address _bondOracle,
        address _seigniorageOracle,
        address _arthLiquidityBoardroom,
        address _arthBoardroom,
        address _fund,
        address _burnbackFund,
        address _gmuOracle,
        uint256 _startTime
    ) public Epoch(1 days, _startTime, 0) {
        cash = _cash;
        bond = _bond;
        share = _share;
        bondOracle = _bondOracle;
        seigniorageOracle = _seigniorageOracle;
        gmuOracle = _gmuOracle;
        arthLiquidityBoardroom = _arthLiquidityBoardroom;
        arthBoardroom = _arthBoardroom;
        developmentFund = _fund;
        burnbackFund = _burnbackFund;

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

    /* ========== VIEW FUNCTIONS ========== */
    // budget
    function getReserve() public view returns (uint256) {
        return accumulatedSeigniorage;
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

        migrated = true;
        emit Migration(target);
    }

    function setFund(address newFund, uint256 rate) public onlyOwner {
        developmentFund = newFund;
        fundAllocationRate = rate;
        emit ContributionPoolChanged(msg.sender, newFund);
        emit ContributionPoolRateChanged(msg.sender, rate);
    }

    function setBurnback(address newFund, uint256 rate) public onlyOwner {
        burnbackFund = newFund;
        burnbackAllocationRate = rate;
        emit BurnBackPoolChanged(msg.sender, newFund);
        emit BurnBackPoolRateChanged(msg.sender, rate);
    }

    function setArthBoardroom(address newFund, uint256 rate) public onlyOwner {
        require(rate + arthLiquidityBoardroomAllocationRate == 100);
        arthBoardroom = newFund;
        arthBoardroomAllocationRate = rate;
        emit ArthBoardroomChanged(msg.sender, newFund);
        emit ArthBoardroomRateChanged(msg.sender, rate);
    }

    function setArthLiquidityBoardroom(address newFund, uint256 rate)
        public
        onlyOwner
    {
        require(rate + arthBoardroomAllocationRate == 100);
        arthLiquidityBoardroom = newFund;
        arthLiquidityBoardroomAllocationRate = rate;
        emit ArthLiquidityBoardroomChanged(msg.sender, newFund);
        emit ArthLiquidityBoardroomRateChanged(msg.sender, rate);
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

    function buyBonds(uint256 amount, uint256 targetPrice)
        external
        onlyOneBlock
        checkMigration
        checkStartTime
        checkOperator
    {
        require(amount > 0, 'Treasury: cannot purchase bonds with zero amount');

        uint256 bondPrice = _getCashPrice(bondOracle);

        cashTargetPrice = getGMUOraclePrice();

        require(bondPrice == targetPrice, 'Treasury: cash price moved');
        require(
            bondPrice < cashTargetPrice, // price < $1
            'Treasury: cashPrice not eligible for bond purchase'
        );

        IBasisAsset(cash).burnFrom(msg.sender, amount);
        IBasisAsset(bond).mint(msg.sender, amount.mul(1e18).div(bondPrice));
        _updateCashPrice();

        emit BoughtBonds(msg.sender, amount);
    }

    function redeemBonds(uint256 amount, uint256 targetPrice)
        external
        onlyOneBlock
        checkMigration
        checkStartTime
        checkOperator
    {
        require(amount > 0, 'Treasury: cannot redeem bonds with zero amount');

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
        uint256 alreadyAllowed =
            IERC20(share).allowance(msg.sender, address(this));

        IERC20(share).safeApprove(
            address(this),
            alreadyAllowed.add(stabilityFeeAmount)
        );

        IERC20(share).safeTransferFrom(
            msg.sender,
            address(this),
            stabilityFeeAmount
        );

        IBasisAsset(bond).burnFrom(msg.sender, amount);
        IERC20(cash).safeTransfer(msg.sender, amount);
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
        if (cashPrice <= cashPriceCeiling) {
            return; // just advance epoch instead revert
        }

        // circulating supply
        uint256 cashSupply =
            IERC20(cash).totalSupply().sub(accumulatedSeigniorage);

        cashTargetPrice = getGMUOraclePrice();

        uint256 percentage = cashPrice.sub(cashTargetPrice);
        uint256 seigniorage = cashSupply.mul(percentage).div(1e18);
        IBasisAsset(cash).mint(address(this), seigniorage);

        // ======================== BIP-3
        // send funds to the community development fund
        uint256 fundReserve = seigniorage.mul(fundAllocationRate).div(100);
        if (fundReserve > 0) {
            IERC20(cash).safeApprove(developmentFund, fundReserve);
            ISimpleERCFund(developmentFund).deposit(
                cash,
                fundReserve,
                'Treasury: Seigniorage Allocation'
            );
            emit ContributionPoolFunded(now, fundReserve);
        }

        // send funds to the burnback fund
        uint256 burnbackReserve = seigniorage.mul(fundAllocationRate).div(100);
        if (burnbackReserve > 0) {
            IERC20(cash).safeApprove(burnbackFund, burnbackReserve);
            ISimpleERCFund(burnbackFund).deposit(
                cash,
                burnbackReserve,
                'Treasury: Seigniorage Allocation'
            );

            // TODO: yash
            emit BurnBackPoolFunded(now, burnbackReserve);
        }

        seigniorage = seigniorage.sub(fundReserve).sub(burnbackReserve);

        // ======================== BIP-4
        // keep funds for all bond token holders
        uint256 treasuryReserve =
            Math.min(
                seigniorage,
                IERC20(bond).totalSupply().sub(accumulatedSeigniorage)
            );

        if (treasuryReserve > 0) {
            accumulatedSeigniorage = accumulatedSeigniorage.add(
                treasuryReserve
            );
            emit TreasuryFunded(now, treasuryReserve);
        }

        // boardroom
        uint256 boardroomReserve = seigniorage.sub(treasuryReserve);
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

        // uint256 pendingReserve = boardroomReserve.sub(mahaBoardroomReserve).sub(arthBoardroomReserve);
        // if (pendingReserve > 0) {
        //     // send it to staking pool rewards
        // }
    }

    // GOV
    event Initialized(address indexed executor, uint256 at);
    event Migration(address indexed target);
    event ContributionPoolChanged(address indexed operator, address newFund);
    event ContributionPoolRateChanged(
        address indexed operator,
        uint256 newRate
    );
    event BurnBackPoolChanged(address indexed operator, address newFund);
    event BurnBackPoolRateChanged(address indexed operator, uint256 newRate);
    event ArthBoardroomChanged(address indexed operator, address newFund);
    event ArthBoardroomRateChanged(address indexed operator, uint256 newRate);
    event ArthLiquidityBoardroomChanged(
        address indexed operator,
        address newFund
    );
    event ArthLiquidityBoardroomRateChanged(
        address indexed operator,
        uint256 newRate
    );

    // CORE
    event RedeemedBonds(address indexed from, uint256 amount);
    event BoughtBonds(address indexed from, uint256 amount);
    event TreasuryFunded(uint256 timestamp, uint256 seigniorage);
    event BoardroomFunded(uint256 timestamp, uint256 seigniorage);
    event ContributionPoolFunded(uint256 timestamp, uint256 seigniorage);
    event BurnBackPoolFunded(uint256 timestamp, uint256 seigniorage);
}

// SPDX-License-Identifier: MIT

pragma solidity ^0.6.0;

import '@openzeppelin/contracts/math/Math.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';
import '../lib/FixedPoint.sol';
import '../lib/Safe112.sol';
import '../owner/Operator.sol';
import '../utils/Epoch.sol';
import '../utils/ContractGuard.sol';

abstract contract TreasuryState is ContractGuard, Epoch {
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

    modifier checkMigration {
        require(!migrated, 'Treasury: migrated');
        _;
    }

    modifier checkOperator {
        require(
            Operator(cash).operator() == address(this) &&
                Operator(bond).operator() == address(this) &&
                Operator(arthLiquidityBoardroom).operator() == address(this) &&
                Operator(arthBoardroom).operator() == address(this),
            'Treasury: need more permission'
        );
        _;
    }
}

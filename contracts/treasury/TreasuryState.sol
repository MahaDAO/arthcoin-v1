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
    address public uniswapRouter;

    address public arthLiquidityBoardroom;
    address public arthBoardroom;
    address public ecosystemFund;

    // oracles
    address public bondOracle;
    address public seigniorageOracle;
    address public gmuOracle;
    address public arthMahaOracle;

    // cash price tracking vars
    uint256 public cashTargetPrice = 1e18;

    // these govern how much bond tokens are issued
    address public curve;
    uint256 public cashToBondConversionLimit = 0;
    uint256 public accumulatedSeigniorage = 0;
    uint256 public accumulatedBonds = 0;

    // used to limit the generation of bond in all situations.
    uint256 public bondConversionRate = 1; // in %

    // used to trigger bond generation if price > (targetPrice + % ) above it.
    uint256 public triggerBondAllocationUpperBandRate = 5; // in %

    // used to trigger bond generation if price < (targetPrice - %) above it.
    uint256 public triggerBondAllocationLowerBandRate = 5; // in %

    // the ecosystem fund recieves seigniorage before anybody else; this
    // value decides how much of the new seigniorage is sent to this fund.
    uint256 public ecosystemFundAllocationRate = 2; // in %

    // this controls how much of the new seigniorage is given to bond token holders.
    // ideally 90% of new seigniorate is given to bond token holders.
    uint256 public bondSeigniorageRate = 90; // in %

    // we decide how much allocation to give to the boardrooms. there
    // are currently two boardrooms; one for ARTH holders and the other for
    // ARTH liqudity providers
    //
    // TODO: make one for maha holders and one for the various community pools
    uint256 public arthLiquidityBoardroomAllocationRate = 60; // In %.
    uint256 public arthBoardroomAllocationRate = 40; // IN %.
    uint256 public mahaBoardroomAllocationRate = 0; // IN %.

    // stability fee is a special fee charged by the protocol in MAHA tokens
    // whenever a person is going to redeem his/her bonds. the fee is charged
    // basis how much ARTHB is being redeemed.
    //
    // eg: a 1% fee means that while redeeming 100 ARTHB, 1 ARTH worth of MAHA is
    // deducted to pay for stability fees.
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

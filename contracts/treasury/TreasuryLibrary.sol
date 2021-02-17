// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import {ContractGuard} from '../utils/ContractGuard.sol';
import {Epoch} from '../utils/Epoch.sol';
import {FixedPoint} from '../lib/FixedPoint.sol';
import {IBoardroom} from '../interfaces/IBoardroom.sol';
import {IERC20} from '@openzeppelin/contracts/contracts/token/ERC20/IERC20.sol';
import {ISimpleERCFund} from '../interfaces/ISimpleERCFund.sol';
import {ISimpleOracle} from '../interfaces/ISimpleOracle.sol';
import {IUniswapOracle} from '../interfaces/IUniswapOracle.sol';
import {IUniswapV2Router02} from '../interfaces/IUniswapV2Router02.sol';
import {Math} from '@openzeppelin/contracts/contracts/math/Math.sol';
import {Operator} from '../owner/Operator.sol';
import {Safe112} from '../lib/Safe112.sol';
import {SafeMath} from '@openzeppelin/contracts/contracts/math/SafeMath.sol';
import {TreasuryLibrary} from './TreasuryLibrary.sol';

library TreasuryLibrary {
    using SafeMath for uint256;

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
        // amount of maha rewarded per epoch.
        uint256 contractionRewardPerEpoch;
        // wut? algo coin surprise sheeet?
        bool enableSurprise;
    }

    struct OracleState {
        IUniswapOracle oracle1hrTWAP;
        IUniswapOracle oracle12hrTWAP;
        ISimpleOracle gmuOracle;
        ISimpleOracle arthMahaOracle;
    }

    struct BoardroomState {
        IBoardroom arthArthLiquidityMlpBoardroom;
        IBoardroom arthMahaBoardroom;
        IBoardroom arthArthBoardroom;
        IBoardroom mahaArthLiquidityMlpBoardroom;
        IBoardroom mahaMahaBoardroom;
        IBoardroom mahaArthBoardroom;
        ISimpleERCFund ecosystemFund;
        ISimpleERCFund rainyDayFund;
        // we decide how much allocation to give to the boardrooms. there
        // are currently two boardrooms; one for ARTH holders and the other for
        // ARTH liqudity providers
        //
        // TODO: make one for maha holders and one for the various community pools
        uint256 arthLiquidityMlpAllocationRate; // In %.
        uint256 arthAllocationRate; // IN %.
        uint256 mahaAllocationRate; // IN %.
        // the ecosystem fund recieves seigniorage before anybody else; this
        // value decides how much of the new seigniorage is sent to this fund.
        uint256 ecosystemFundAllocationRate; // in %
        uint256 rainyDayFundAllocationRate; // in %
    }

    function getCashPrice(IUniswapOracle oracle, IERC20 token)
        public
        view
        returns (uint256)
    {
        try oracle.consult(address(token), 1e18) returns (uint256 price) {
            return price;
        } catch {
            revert('Treasury: failed to consult cash price from the oracle');
        }
    }

    function getPercentDeviationFromTarget(uint256 price, ISimpleOracle oracle)
        public
        view
        returns (uint256)
    {
        uint256 target = oracle.getPrice();
        if (price > target) return price.sub(target).mul(100).div(target);
        return target.sub(price).mul(100).div(target);
    }
}

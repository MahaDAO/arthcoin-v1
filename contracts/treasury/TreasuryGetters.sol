// SPDX-License-Identifier: MIT

pragma solidity ^0.6.0;

import '@openzeppelin/contracts/math/Math.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';
import '@openzeppelin/contracts/utils/ReentrancyGuard.sol';

import '../interfaces/IOracle.sol';
import '../interfaces/IBoardroom.sol';
import '../interfaces/IBasisAsset.sol';
import '../interfaces/ISimpleERCFund.sol';
import '../lib/Babylonian.sol';
import '../curve/Curve.sol';

import '../lib/FixedPoint.sol';
import '../lib/Safe112.sol';
import '../owner/Operator.sol';
import '../utils/Epoch.sol';
import '../utils/ContractGuard.sol';
import './TreasuryState.sol';

import '../interfaces/ICustomERC20.sol';
import '../interfaces/IUniswapV2Factory.sol';
import {IUniswapV2Router02} from '../interfaces/IUniswapV2Router02.sol';

abstract contract TreasuryGetters is TreasuryState {
    function getReserve() public view returns (uint256) {
        return accumulatedSeigniorage;
    }

    function getBondConversionRate() public view returns (uint256) {
        return bondConversionRate;
    }

    function getStabilityFee() public view returns (uint256) {
        return stabilityFee;
    }

    function getBondOraclePrice() public view returns (uint256) {
        return _getCashPrice(bondOracle);
    }

    function getGMUOraclePrice() public view returns (uint256) {
        return IOracle(gmuOracle).getPrice();
    }

    function getArthMahaOraclePrice() public view returns (uint256) {
        return IOracle(arthMahaOracle).getPrice();
    }

    function getPercentDeviationFromTarget(uint256 cashPrice)
        public
        view
        returns (uint256)
    {
        return cashTargetPrice.sub(cashPrice).mul(1e18).div(cashTargetPrice);
    }

    function getPercentTargetDevianceFromPrice(uint256 cashPrice)
        public
        view
        returns (uint256)
    {
        return cashPrice.sub(cashTargetPrice).mul(1e18).div(cashTargetPrice);
    }

    function getSeigniorageOraclePrice() public view returns (uint256) {
        return _getCashPrice(seigniorageOracle);
    }

    function arthCirculatingSupply() public view returns (uint256) {
        return IERC20(cash).totalSupply().sub(accumulatedSeigniorage);
    }

    function getBondRedemtionPrice() public view returns (uint256) {
        return cashTargetPrice.mul(safetyRegion.add(100)).div(100); // 1.05%
    }

    function getBondPurchasePrice() public view returns (uint256) {
        return
            cashTargetPrice
                .mul(uint256(100).sub(triggerBondAllocationLowerBandRate))
                .div(100); // 0.95%
    }

    function getCashSupplyInLiquidity() public view returns (uint256) {
        // check if enabled or not
        if (!considerUniswapLiquidity) return uint256(100);

        address uniswapFactory = IUniswapV2Router02(uniswapRouter).factory();
        address uniswapLiquidityPair =
            IUniswapV2Factory(uniswapFactory).getPair(cash, dai);

        // Get the liquidity of cash locked in uniswap pair.
        uint256 uniswapLiquidityPairCashBalance =
            ICustomERC20(cash).balanceOf(uniswapLiquidityPair);

        // Get the liquidity percent.
        return
            uniswapLiquidityPairCashBalance.mul(100).div(
                ICustomERC20(cash).totalSupply()
            );
    }

    function getCeilingPrice() public view returns (uint256) {
        return ICurve(curve).calcCeiling(arthCirculatingSupply());
    }

    function get1hourEpoch() public view returns (uint256) {
        return Epoch(bondOracle).getLastEpoch();
    }

    function _getCashPrice(address oracle) internal view returns (uint256) {
        try IOracle(oracle).getPrice() returns (uint256 price) {
            return price;
        } catch {
            revert('Treasury: failed to consult cash price from the oracle');
        }
    }
}

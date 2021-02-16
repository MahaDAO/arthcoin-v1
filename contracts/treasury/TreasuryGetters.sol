// SPDX-License-Identifier: MIT

pragma solidity ^0.6.10;

import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {Math} from '@openzeppelin/contracts/math/Math.sol';

import {IUniswapOracle} from '../interfaces/IUniswapOracle.sol';
import {ISimpleOracle} from '../interfaces/ISimpleOracle.sol';
import {TreasuryState} from './TreasuryState.sol';
import {Epoch} from '../utils/Epoch.sol';
import {ICustomERC20} from '../interfaces/ICustomERC20.sol';
import {IUniswapV2Factory} from '../interfaces/IUniswapV2Factory.sol';
import {IUniswapV2Router02} from '../interfaces/IUniswapV2Router02.sol';

import {TreasuryLibrary} from './TreasuryLibrary.sol';

abstract contract TreasuryGetters is TreasuryState {
    function getReserve() public view returns (uint256) {
        return accumulatedSeigniorage;
    }

    function getStabilityFee() public view returns (uint256) {
        return stabilityFee;
    }

    function getGMUOraclePrice() public view returns (uint256) {
        return gmuOracle.getPrice();
    }

    function getArthMahaOraclePrice() public view returns (uint256) {
        return arthMahaOracle.getPrice();
    }

    function get12hrTWAPOraclePrice() public view returns (uint256) {
        return TreasuryLibrary.getCashPrice(seigniorageOracle, cash);
    }

    function get1hrTWAPOraclePrice() public view returns (uint256) {
        return TreasuryLibrary.getCashPrice(bondOracle, cash);
    }

    function arthCirculatingSupply() public view returns (uint256) {
        return cash.totalSupply().sub(accumulatedSeigniorage);
    }

    function bondCirculatingSupply() public view returns (uint256) {
        return bond.totalSupply().sub(accumulatedSeigniorage);
    }

    /**
     * Understand how much Seignorage should be minted
     */
    function estimateSeignorageToMint(uint256 price)
        public
        view
        returns (uint256)
    {
        if (price <= cashTargetPrice) return 0; // < $1.00

        // cap the max supply increase per epoch to only 30%
        uint256 finalPercentage =
            Math.min(
                TreasuryLibrary.getPercentDeviationFromTarget(price, gmuOracle),
                maxSupplyIncreasePerEpoch
            );

        // take into consideration uniswap liq. if flag is on, ie how much liquidity is there in the ARTH uniswap pool
        uint256 toMint = arthCirculatingSupply().mul(finalPercentage).div(100);

        // if we are below the expansion price limit; only pay back bond holders if we are within the right price range
        // < $1.05
        if (price <= getExpansionLimitPrice()) {
            return Math.min(toMint, bondCirculatingSupply());
        }

        return toMint;
    }

    function estimateBondsToIssue(uint256 price) public view returns (uint256) {
        // check if we are in contraction mode.
        if (price > getBondPurchasePrice()) return 0; // <= $0.95

        // in contraction mode -> issue bonds.
        // set a limit to how many bonds are there.

        uint256 percentage =
            TreasuryLibrary.getPercentDeviationFromTarget(price, gmuOracle);

        // understand how much % deviation do we have from target price
        // if target price is 2.5$ and we are at 2$; then percentage should be 20%
        // cap the bonds to be issed; we don't want too many
        uint256 finalPercentage = Math.min(percentage, maxDebtIncreasePerEpoch);

        // accordingly set the new conversion limit to be that % from the
        // current circulating supply of ARTH and if uniswap enabled then uniswap liquidity.
        return
            arthCirculatingSupply()
                .mul(finalPercentage)
                .div(100)
                .mul(getCashSupplyInLiquidity())
                .div(100);
    }

    function getBondRedemtionPrice() public view returns (uint256) {
        return cashTargetPrice; // 1$
    }

    function getExpansionLimitPrice() public view returns (uint256) {
        return cashTargetPrice.mul(safetyRegion.add(100)).div(100); // 1.05$
    }

    function getBondPurchasePrice() public view returns (uint256) {
        return cashTargetPrice.mul(uint256(100).sub(safetyRegion)).div(100); // 0.95$
    }

    function getCashSupplyInLiquidity() public view returns (uint256) {
        // check if enabled or not
        if (!considerUniswapLiquidity) return uint256(100);

        // Get the liquidity of cash locked in uniswap pair.
        uint256 uniswapLiquidityPairCashBalance =
            cash.balanceOf(uniswapLiquidityPair);

        // Get the liquidity percent.
        return uniswapLiquidityPairCashBalance.mul(100).div(cash.totalSupply());
    }
}

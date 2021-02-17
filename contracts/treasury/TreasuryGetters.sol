// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import {Math} from '@openzeppelin/contracts/contracts/math/Math.sol';
import {SafeMath} from '@openzeppelin/contracts/contracts/math/SafeMath.sol';
import {TreasuryLibrary} from './TreasuryLibrary.sol';
import {TreasuryState} from './TreasuryState.sol';

abstract contract TreasuryGetters is TreasuryState {
    using SafeMath for uint256;

    // this function is to be used with multicall.js
    function getState()
        external
        view
        returns (
            TreasuryLibrary.State memory s,
            TreasuryLibrary.OracleState memory o,
            TreasuryLibrary.BoardroomState memory b
        )
    {
        return (state, oracleState, boardroomState);
    }

    function getGMUOraclePrice() public view returns (uint256) {
        return oracleState.gmuOracle.getPrice();
    }

    function getArthMahaOraclePrice() public view returns (uint256) {
        return oracleState.arthMahaOracle.getPrice();
    }

    function get12hrTWAPOraclePrice() public view returns (uint256) {
        return TreasuryLibrary.getCashPrice(oracleState.oracle12hrTWAP, cash);
    }

    function get1hrTWAPOraclePrice() public view returns (uint256) {
        return TreasuryLibrary.getCashPrice(oracleState.oracle1hrTWAP, cash);
    }

    function arthCirculatingSupply() public view returns (uint256) {
        return cash.totalSupply().sub(state.accumulatedSeigniorage);
    }

    function bondCirculatingSupply() public view returns (uint256) {
        return bond.totalSupply().sub(state.accumulatedSeigniorage);
    }

    /**
     * Understand how much Seignorage should be minted
     */
    function estimateSeignorageToMint(uint256 price)
        public
        view
        returns (uint256)
    {
        if (price <= state.cashTargetPrice) return 0; // < $1.00

        // cap the max supply increase per epoch to only 30%
        uint256 finalPercentage =
            Math.min(
                TreasuryLibrary.getPercentDeviationFromTarget(
                    price,
                    oracleState.gmuOracle
                ),
                state.maxSupplyIncreasePerEpoch
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
            TreasuryLibrary.getPercentDeviationFromTarget(
                price,
                oracleState.gmuOracle
            );

        // understand how much % deviation do we have from target price
        // if target price is 2.5$ and we are at 2$; then percentage should be 20%
        // cap the bonds to be issed; we don't want too many
        uint256 finalPercentage =
            Math.min(percentage, state.maxDebtIncreasePerEpoch);

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
        return state.cashTargetPrice; // 1$
    }

    function getExpansionLimitPrice() public view returns (uint256) {
        return state.cashTargetPrice.mul(state.safetyRegion.add(100)).div(100); // 1.05$
    }

    function getBondPurchasePrice() public view returns (uint256) {
        return
            state.cashTargetPrice.mul(uint256(100).sub(state.safetyRegion)).div(
                100
            ); // 0.95$
    }

    function getCashSupplyInLiquidity() public view returns (uint256) {
        // check if enabled or not
        if (!state.considerUniswapLiquidity) return uint256(100);

        // Get the liquidity of cash locked in uniswap pair.
        uint256 uniswapLiquidityPairCashBalance =
            cash.balanceOf(state.uniswapLiquidityPair);

        // Get the liquidity percent.
        return uniswapLiquidityPairCashBalance.mul(100).div(cash.totalSupply());
    }
}

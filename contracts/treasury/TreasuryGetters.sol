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
import '../interfaces/IGMUOracle.sol';
import './TreasuryState.sol';

abstract contract TreasuryGetters is TreasuryState {
    function getReserve() public view returns (uint256) {
        return accumulatedSeigniorage;
    }

    function getStabilityFee() public view returns (uint256) {
        return stabilityFee;
    }

    function getBondOraclePrice() public view returns (uint256) {
        return _getCashPrice(bondOracle);
    }

    function getGMUOraclePrice() public view returns (uint256) {
        return IGMUOracle(gmuOracle).getPrice();
    }

    function getMAHAUSDOraclePrice() public view returns (uint256) {
        return IGMUOracle(mahausdOracle).getPrice();
    }

    function getSeigniorageOraclePrice() public view returns (uint256) {
        return _getCashPrice(seigniorageOracle);
    }

    function arthCirculatingSupply() public view returns (uint256) {
        return IERC20(cash).totalSupply().sub(accumulatedSeigniorage);
    }

    function getCeilingPrice() public view returns (uint256) {
        return ICurve(curve).calcCeiling(arthCirculatingSupply());
    }

    function get1hourEpoch() public view returns (uint256) {
        return Epoch(bondOracle).getLastEpoch();
    }

    function get12hourEpoch() public view returns (uint256) {
        return Epoch(seigniorageOracle).getLastEpoch();
    }

    function _getCashPrice(address oracle) internal view returns (uint256) {
        try IOracle(oracle).consult(cash, 1e18) returns (uint256 price) {
            return price;
        } catch {
            revert('Treasury: failed to consult cash price from the oracle');
        }
    }
}

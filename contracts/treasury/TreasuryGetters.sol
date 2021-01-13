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

    function getCashPriceCeiling() public view returns (uint256) {
        return cashTargetPrice + uint256(5).mul(cashTargetPrice).div(10**2);
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

    function _getCashPrice(address oracle) internal view returns (uint256) {
        try IOracle(oracle).consult(cash, 1e18) returns (uint256 price) {
            return price;
        } catch {
            revert('Treasury: failed to consult cash price from the oracle');
        }
    }
}

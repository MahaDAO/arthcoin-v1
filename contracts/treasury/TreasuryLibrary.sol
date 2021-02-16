// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import {Math} from '@openzeppelin/contracts/contracts/math/Math.sol';
import {SafeMath} from '@openzeppelin/contracts/contracts/math/SafeMath.sol';
import {IERC20} from '@openzeppelin/contracts/contracts/token/ERC20/IERC20.sol';
import {IBasisAsset} from '../interfaces/IBasisAsset.sol';
import {FixedPoint} from '../lib/FixedPoint.sol';
import {Safe112} from '../lib/Safe112.sol';
import {Operator} from '../owner/Operator.sol';
import {Epoch} from '../utils/Epoch.sol';
import {ContractGuard} from '../utils/ContractGuard.sol';
import {ISimpleOracle} from '../interfaces/ISimpleOracle.sol';
import {IUniswapOracle} from '../interfaces/IUniswapOracle.sol';
import {IUniswapV2Router02} from '../interfaces/IUniswapV2Router02.sol';
import {IBoardroom} from '../interfaces/IBoardroom.sol';
import {TreasuryLibrary} from './TreasuryLibrary.sol';
import {ISimpleERCFund} from '../interfaces/ISimpleERCFund.sol';

library TreasuryLibrary {
    using SafeMath for uint256;

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

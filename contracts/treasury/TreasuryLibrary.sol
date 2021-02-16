// SPDX-License-Identifier: MIT

pragma solidity ^0.6.10;

import {Math} from '@openzeppelin/contracts/math/Math.sol';
import {SafeMath} from '@openzeppelin/contracts/math/SafeMath.sol';

import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {ISimpleOracle} from '../interfaces/ISimpleOracle.sol';
import {IUniswapOracle} from '../interfaces/IUniswapOracle.sol';

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

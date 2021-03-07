// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import {IERC20} from '@openzeppelin/contracts/contracts/token/ERC20/IERC20.sol';
import {
    AccessControl
} from '@openzeppelin/contracts/contracts/access/AccessControl.sol';
import {Operator} from '../../owner/Operator.sol';
import {SafeMath} from '@openzeppelin/contracts/contracts/math/SafeMath.sol';
import {StakingTimelock} from '../../timelock/StakingTimelock.sol';
import {IVaultBoardroom} from '../../interfaces/IVaultBoardroom.sol';
import {IVault} from '../../interfaces/IVault.sol';

contract VaultSnapshot is Operator, IVault {
    using SafeMath for uint256;

    uint256 internal _totalSupply;

    mapping(address => uint256) internal _balances;

    function totalSupply() external view override returns (uint256) {
        return _totalSupply;
    }

    function balanceOf(address who) external view override returns (uint256) {
        return _balances[who];
    }

    function totalBondedSupply() external view override returns (uint256) {
        return _totalSupply;
    }

    function balanceWithoutBonded(address who)
        external
        view
        override
        returns (uint256)
    {
        return _balances[who];
    }

    function setBalances(address[] memory who, uint256[] memory amt)
        public
        onlyOwner
    {
        for (uint256 i = 0; i < who.length; i++) {
            _balances[who[i]] = amt[i];
        }
    }

    function setTotalSupply(uint256 amt) public onlyOwner {
        _totalSupply = amt;
    }

    function bond(uint256 amount) external virtual override {}

    function bondFor(address who, uint256 amount) external virtual override {}

    function unbond(uint256 amount) external virtual override {}

    function withdraw() external virtual override {}
}

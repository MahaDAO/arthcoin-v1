// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import {Treasury} from './Treasury.sol';
import {Operator} from '../owner/Operator.sol';
import {IBasisAsset} from '../interfaces/IBasisAsset.sol';

contract RBAC is Operator {
    /**
     * State variables.
     */

    // This RBAC contract has to be the operator/owner of this contract.
    IBasisAsset cash;
    IBasisAsset bond;

    // Treasury has to be the operator of this RBAC contract.
    address treasury;

    /**
     * Constructor.
     */
    constructor(
        IERC20 cash_,
        IERC20 bond_,
        address treasury_
    ) {
        cash = cash_;
        bond = bond_;
        treasury = treasury_;
    }

    /**
     * Settters.
     */
    function setTreasury(address newTreasury) public onlyOwner {
        treasury = newTreasury;
    }

    /**
     * Mutations.
     */

    function migrate(address newTreasury) public onlyOperator {
        treausry = newTreasury;
    }

    function mintCash(address account, uint256 amount) onlyOperator {
        cash.mint(account, amount);
    }

    function mintBond(address account, uint256 amount) onlyOperator {
        bond.mint(account, amount);
    }

    function burnCash(address account, uint256 amount) onlyOperator {
        cash.burnFrom(account, amount);
    }

    function burnBond(address account, uint256 amount) onlyOperator {
        bond.burnFrom(account, amount);
    }

    function transferCash(address account, uint256 amount) onlyOperator {
        cash.trasnfer(account, amount);
    }

    function transferBond(address account, uint256 amount) onlyOperator {
        bond.trasnfer(account, amount);
    }
}

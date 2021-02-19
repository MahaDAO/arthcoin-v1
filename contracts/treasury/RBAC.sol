// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import {Treasury} from './Treasury.sol';
import {Operator} from '../owner/Operator.sol';
import {IBasisAsset} from '../interfaces/IBasisAsset.sol';

contract RBAC is Operator {
    /**
     * State variables.
     */

    IBasisAsset cash;
    IBasisAsset bond;
    address treasury;

    /**
     * Constructor.
     */
    constructor(
        address treasury_,
        IERC20 cash_,
        IERC20 bond_
    ) {
        cash = cash_;
        bond = bond_;
        treasury = treasury_;
    }

    /**
     * Modifiers.
     */
    modifier onlyTreasury {
        require(msg.sender == address(treasury), 'RBAC: forbidden');

        _;
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

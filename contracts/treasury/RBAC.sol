// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import '@openzeppelin/contracts/contracts/access/Ownable.sol';

import {IBasisAsset} from '../interfaces/IBasisAsset.sol';

contract Maharaja is Ownable {
    /**
     * State variables.
     */

    // RBAC contract has to be the operator/owner of these assets.
    IBasisAsset public cash;
    IBasisAsset public bond;

    // The treasury that will be using this RBAC.
    address public treasury;

    /**
     * Constructor.
     */
    constructor(
        IBasisAsset cash_,
        IBasisAsset bond_,
        address treasury_
    ) {
        cash = cash_;
        bond = bond_;
        treasury = treasury_;
    }

    /**
     * Modifiers.
     */
    modifier onlyTreasury() {
        require(msg.sender == treasury, 'RBAC: forbidden');

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

    function refundBond() public onlyOwner {
        bond.transfer(owner(), bond.balanceOf(address(this)));
    }

    function refundCash() public onlyOwner {
        cash.transfer(owner(), cash.balanceOf(address(this)));
    }

    function migrate(address newTreasury) public onlyTreasury {
        treasury = newTreasury;
    }

    function mintCash(address account, uint256 amount) public onlyTreasury {
        cash.mint(account, amount);
    }

    function mintBond(address account, uint256 amount) public onlyTreasury {
        bond.mint(account, amount);
    }

    function burnCash(address account, uint256 amount) public onlyTreasury {
        cash.burnFrom(account, amount);
    }

    function burnBond(address account, uint256 amount) public onlyTreasury {
        bond.burnFrom(account, amount);
    }
}

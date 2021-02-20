// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import {BaseToken} from './BaseToken.sol';

contract ARTH is BaseToken {
    /**
     * @notice Constructs the Basis ARTH ERC-20 contract.
     */
    constructor() BaseToken('ARTH', 'ARTH') {
        // Mints 1 Basis ARTH to contract creator for initial Uniswap oracle deployment.
        // Will be burned after oracle deployment.
        _mint(msg.sender, 1 * 10**18);
    }
}

// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import {BaseToken} from './BaseToken.sol';

contract ARTHB is BaseToken {
    /**
     * @notice Constructs the Basis ARTHB ERC-20 contract.
     */
    constructor() BaseToken('ARTH Bond', 'ARTHB') {}
}

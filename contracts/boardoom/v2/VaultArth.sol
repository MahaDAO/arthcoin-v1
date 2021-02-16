// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import '../core/Vault.sol';

contract VaultArth is Vault {
    constructor(IERC20 cash_, uint256 lockIn_) Vault(cash_, lockIn_) {}
}

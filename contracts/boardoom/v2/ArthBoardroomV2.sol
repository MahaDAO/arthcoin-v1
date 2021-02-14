// SPDX-License-Identifier: MIT

pragma solidity ^0.6.12;

import '../core/VestedVaultBoardroom.sol';

contract ArthBoardroomV2 is VestedVaultBoardroom {
    constructor(
        IERC20 cash_,
        Vault vault_,
        uint256 vestFor_
    ) public VestedVaultBoardroom(cash_, vault_, vestFor_) {}
}

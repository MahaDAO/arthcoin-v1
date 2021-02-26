// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import {Vault} from '../core/Vault.sol';
import {IERC20} from '@openzeppelin/contracts/contracts/token/ERC20/IERC20.sol';
import {VaultBoardroom} from '../core/VaultBoardroom.sol';

contract MahaArthMlpLiquidityBoardroomV2 is VaultBoardroom {
    constructor(IERC20 cash_, Vault arthMlpVault_)
        VaultBoardroom(cash_, arthMlpVault_)
    {}
}

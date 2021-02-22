// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import {IBoardroom} from './IBoardroom.sol';

interface IVaultBoardroom is IBoardroom {
    function updateRewards(address who) external;
}

// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';

interface ISimpleERCFund {
    function deposit(
        IERC20 token,
        uint256 amount,
        string memory reason
    ) external;

    function withdraw(
        IERC20 token,
        uint256 amount,
        address to,
        string memory reason
    ) external;
}

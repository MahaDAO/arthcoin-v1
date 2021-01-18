// SPDX-License-Identifier: MIT

pragma solidity ^0.6.0;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';

interface ICustomERC20 is IERC20 {
    using SafeERC20 for IERC20;

    function burnFrom(
        address owner,
        address spender,
        uint256 amount
    ) external;
}

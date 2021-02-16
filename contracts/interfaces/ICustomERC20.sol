// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import {IERC20} from '@openzeppelin/contracts/contracts/token/ERC20/IERC20.sol';

interface ICustomERC20 is IERC20 {
    function burnFrom(address account, uint256 amount) external;
}

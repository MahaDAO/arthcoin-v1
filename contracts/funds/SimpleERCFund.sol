// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import {IERC20} from '@openzeppelin/contracts/contracts/token/ERC20/IERC20.sol';
import {ISimpleERCFund} from '../interfaces/ISimpleERCFund.sol';
import {Ownable} from '@openzeppelin/contracts/contracts/access/Ownable.sol';

contract SimpleERCFund is ISimpleERCFund, Ownable {
    function deposit(
        IERC20 token,
        uint256 amount,
        string memory reason
    ) public override {
        token.transferFrom(msg.sender, address(this), amount);
        emit Deposit(token, msg.sender, block.timestamp, reason);
    }

    function withdraw(
        IERC20 token,
        uint256 amount,
        address to,
        string memory reason
    ) public override onlyOwner {
        token.transfer(to, amount);
        emit Withdrawal(token, msg.sender, to, block.timestamp, reason);
    }

    event Deposit(
        IERC20 indexed token,
        address indexed from,
        uint256 at,
        string reason
    );
    event Withdrawal(
        IERC20 indexed token,
        address indexed from,
        address indexed to,
        uint256 at,
        string reason
    );
}

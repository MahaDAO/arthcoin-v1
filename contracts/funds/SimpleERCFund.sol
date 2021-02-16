// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';
import '@openzeppelin/contracts/access/Ownable.sol';

import '../interfaces/ISimpleERCFund.sol';

contract SimpleERCFund is ISimpleERCFund, Ownable {
    using SafeERC20 for IERC20;

    function deposit(
        IERC20 token,
        uint256 amount,
        string memory reason
    ) public override {
        token.safeTransferFrom(msg.sender, address(this), amount);
        emit Deposit(token, msg.sender, now, reason);
    }

    function withdraw(
        IERC20 token,
        uint256 amount,
        address to,
        string memory reason
    ) public override onlyOwner {
        token.safeTransfer(to, amount);
        emit Withdrawal(token, msg.sender, to, now, reason);
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

// SPDX-License-Identifier: MIT

pragma solidity ^0.6.0;

import '@openzeppelin/contracts/math/Math.sol';
import '@openzeppelin/contracts/math/SafeMath.sol';
import '@openzeppelin/contracts/utils/Address.sol';
import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';

contract TOKENWrapper is Ownable {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    IERC20 public token;
    bool public limitPoolSize;
    uint256 public maxPoolSize;
    uint256 private _totalSupply;

    mapping(address => uint256) private _balances;

    modifier checkPoolSize(uint256 amountToBeStaked) {
        if (limitPoolSize)
            require(
                _totalSupply.add(amountToBeStaked) <= maxPoolSize,
                'Pool: Cannot stake pool limit reached'
            );

        _;
    }

    function changeToken(address newToken) public onlyOwner {
        require(newToken != address(0), 'Pool: invalid token');

        token = IERC20(newToken);
    }

    function modifyMaxPoolSize(uint256 newPoolSize) public onlyOwner {
        require(newPoolSize > 0, 'Pool: size of pool cannot be 0');

        maxPoolSize = newPoolSize;
    }

    function resetLimitingPoolSize() public onlyOwner {
        limitPoolSize = false;
    }

    function setLimitingPoolSize() public onlyOwner {
        limitPoolSize = true;
    }

    function totalSupply() public view returns (uint256) {
        return _totalSupply;
    }

    function balanceOf(address account) public view returns (uint256) {
        return _balances[account];
    }

    function stake(uint256 amount) public virtual checkPoolSize(amount) {
        require(amount > 0, 'Pool: cannot stake 0');

        _totalSupply = _totalSupply.add(amount);
        _balances[msg.sender] = _balances[msg.sender].add(amount);
        token.safeTransferFrom(msg.sender, address(this), amount);
    }

    function withdraw(uint256 amount) public virtual {
        require(amount > 0, 'Pool: cannot withdraw 0 amount');

        _totalSupply = _totalSupply.sub(amount);
        _balances[msg.sender] = _balances[msg.sender].sub(amount);
        token.safeTransfer(msg.sender, amount);
    }
}

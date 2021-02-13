// SPDX-License-Identifier: MIT

pragma solidity ^0.6.12;
// pragma experimental ABIEncoderV2;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';

import '../../owner/Operator.sol';
import '../../owner/Router.sol';
import '../../timelock/StakingTimelock.sol';

contract BaseBoardroom is StakingTimelock, Router, Operator {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    IERC20 public share;

    uint256 internal _totalSupply;
    bool public enableDeposits = true;
    mapping(address => uint256) internal _balances;

    modifier depositsEnabled() {
        require(enableDeposits, 'boardroom: deposits are disabled');
        _;
    }

    constructor(IERC20 share_, uint256 duration_)
        public
        StakingTimelock(duration_)
    {
        share = share_;
    }

    function totalSupply() public view returns (uint256) {
        return _totalSupply;
    }

    function balanceOf(address account) public view returns (uint256) {
        return _balances[account];
    }

    function toggleDeposits(bool val) external onlyOwner {
        enableDeposits = val;
    }

    function refund(bool val) external onlyOwner {
        share.safeTransfer(msg.sender, share.balanceOf(address(this)));
    }

    function bond(uint256 amount) public virtual depositsEnabled {
        require(amount > 0, 'Boardroom: Cannot bond 0');

        _totalSupply = _totalSupply.add(amount);
        _balances[msg.sender] = _balances[msg.sender].add(amount);
        share.safeTransferFrom(msg.sender, address(this), amount);

        emit Bonded(msg.sender, amount);
    }

    function unbond(uint256 amount) internal virtual {
        require(amount > 0, 'Boardroom: Cannot unbond 0');

        uint256 directorShare = _balances[msg.sender];

        require(
            directorShare >= amount,
            'Boardroom: unbond request greater than staked amount'
        );

        _updateStakerDetails(msg.sender, block.timestamp + duration, amount);

        emit Unbonded(msg.sender, amount);
    }

    function withdraw() internal checkLockDuration {
        uint256 directorShare = _balances[msg.sender];
        uint256 amount = getStakedAmount(msg.sender);

        require(
            directorShare >= amount,
            'Boardroom: withdraw request greater than unbonded amount'
        );

        _totalSupply = _totalSupply.sub(amount);
        _balances[msg.sender] = directorShare.sub(amount);
        share.safeTransfer(msg.sender, amount);

        _updateStakerDetails(msg.sender, block.timestamp, 0);

        emit Withdrawn(msg.sender, amount);
    }

    event Bonded(address indexed user, uint256 amount);
    event Unbonded(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
}

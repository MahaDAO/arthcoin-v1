// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import {IERC20} from '@openzeppelin/contracts/contracts/token/ERC20/IERC20.sol';
import {Operator} from '../../owner/Operator.sol';
import {SafeMath} from '@openzeppelin/contracts/contracts/math/SafeMath.sol';
import {StakingTimelock} from '../../timelock/StakingTimelock.sol';

/**
 * A vault is a contract that handles only the bonding & unbonding of tokens;
 * Rewards are handled by the boardroom contracts.
 */
contract Vault is StakingTimelock, Operator {
    using SafeMath for uint256;

    /**
     * State variables.
     */

    // The staked token.
    IERC20 public share;

    uint256 internal _totalSupply;
    bool public enableDeposits = true;

    mapping(address => uint256) internal _balances;

    /**
     * Modifier.
     */

    modifier stakerExists {
        require(
            balanceOf(msg.sender) > 0,
            'Boardroom: The director does not exist'
        );
        _;
    }

    /**
     * Events.
     */

    event Bonded(address indexed user, uint256 amount);
    event Unbonded(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);

    /**
     * Constructor.
     */
    constructor(IERC20 share_, uint256 duration_) StakingTimelock(duration_) {
        share = share_;
    }

    /**
     * Getters.
     */

    function totalSupply() public view returns (uint256) {
        return _totalSupply;
    }

    function balanceOf(address account) public view returns (uint256) {
        return _balances[account];
    }

    function balanceWithoutBonded(address account)
        public
        view
        returns (uint256)
    {
        uint256 amount = getStakedAmount(msg.sender);
        return _balances[account].sub(amount);
    }

    /**
     * Setters.
     */

    function toggleDeposits(bool val) external onlyOwner {
        enableDeposits = val;
    }

    /**
     * Mutations.
     */
    function bond(uint256 amount) public virtual {
        require(amount > 0, 'Boardroom: cannot bond 0');
        require(enableDeposits, 'Boardroom: deposits are disabled');

        _totalSupply = _totalSupply.add(amount);
        _balances[msg.sender] = _balances[msg.sender].add(amount);

        // NOTE: has to be pre-approved.
        share.transferFrom(msg.sender, address(this), amount);

        emit Bonded(msg.sender, amount);
    }

    function unbond(uint256 amount) public virtual stakerExists {
        require(amount > 0, 'Boardroom: cannot unbond 0');

        uint256 directorShare = _balances[msg.sender];

        require(
            directorShare >= amount,
            'Boardroom: unbond request greater than staked amount'
        );

        _updateStakerDetails(msg.sender, block.timestamp + duration, amount);

        emit Unbonded(msg.sender, amount);
    }

    function withdraw() public stakerExists checkLockDuration {
        uint256 directorShare = _balances[msg.sender];
        uint256 amount = getStakedAmount(msg.sender);

        require(
            directorShare >= amount,
            'Boardroom: withdraw request greater than unbonded amount'
        );

        _totalSupply = _totalSupply.sub(amount);
        _balances[msg.sender] = directorShare.sub(amount);
        share.transfer(msg.sender, amount);

        _updateStakerDetails(msg.sender, block.timestamp, 0);

        emit Withdrawn(msg.sender, amount);
    }
}

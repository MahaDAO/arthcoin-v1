// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import {SafeMath} from '@openzeppelin/contracts/contracts/math/SafeMath.sol';
import {IERC20} from '@openzeppelin/contracts/contracts/token/ERC20/IERC20.sol';

import {Vault} from './Vault.sol';
import {Operator} from '../../owner/Operator.sol';
import {VestedVaultBoardroom} from './VestedVaultBoardroom.sol';
import {StakingTimelock} from '../../timelock/StakingTimelock.sol';

contract ExpansionJar is StakingTimelock {
    using SafeMath for uint256;

    Vault vault;
    IERC20 token;
    VestedVaultBoardroom boardroom;

    uint256 internal _totalSupply;
    mapping(address => uint256) internal _balances;

    modifier stakerExists(address who) {
        require(balanceOf(who) > 0, 'Boardroom: The director does not exist');
        _;
    }

    constructor(
        IERC20 token_,
        Vault vault_,
        VestedVaultBoardroom boardroom_,
        uint256 duration_
    ) public StakingTimelock(duration_) {
        vault = vault_;
        token = token_;
        boardroom = boardroom_;
    }

    function totalSupply() public view returns (uint256) {
        return _totalSupply;
    }

    function balanceOf(address who) public view returns (uint256) {
        return _balances[who];
    }

    function bond(uint256 amount) public {
        require(amount > 0, 'Jar: amount = 0');

        vault.bond(amount);

        _totalSupply = _totalSupply.add(amount);
        _balances[msg.sender] = _balances[msg.sender].add(amount);
    }

    function unbond(uint256 amount) public stakerExists(msg.sender) {
        uint256 directorShare = _balances[msg.sender];

        require(
            directorShare >= amount,
            'Jar: unbond request greater than staked amount'
        );

        _updateStakerDetails(mgs.sender, block.timestamp + duration, amount);
    }

    function claimAndReinvest() public onlyOwner {
        boardroom.claimAndReinvestReward();
    }

    function withdraw()
        public
        stakerExists(msg.sender)
        checkLockDurationFor(msg.sender)
    {
        uint256 directorShare = _balances[msg.sender];
        uint256 amount = getStakedAmount(msg.sender);

        require(
            directorShare >= amount,
            'Jar: withdraw request greater than unbonded amount'
        );

        _totalSupply = _totalSupply.sub(amount);
        _balances[msg.sender] = directorShare.sub(amount);
        token.transfer(msg.sender, amount);

        _updateStakerDetails(msg.sender, block.timestamp, 0);
    }
}

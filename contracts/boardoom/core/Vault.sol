// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import {IERC20} from '@openzeppelin/contracts/contracts/token/ERC20/IERC20.sol';
import {
    AccessControl
} from '@openzeppelin/contracts/contracts/access/AccessControl.sol';
import {Operator} from '../../owner/Operator.sol';
import {SafeMath} from '@openzeppelin/contracts/contracts/math/SafeMath.sol';
import {StakingTimelock} from '../../timelock/StakingTimelock.sol';

/**
 * A vault is a contract that handles only the bonding & unbonding of tokens;
 * Rewards are handled by the boardroom contracts.
 */
contract Vault is AccessControl, StakingTimelock, Operator {
    using SafeMath for uint256;

    bytes32 public constant BOARDROOM_ROLE = keccak256('BOARDROOM_ROLE');

    /**
     * Data structures.
     */
    struct BondingDetail {
        uint256 firstBondedOn;
        uint256 latestBondedOn;
        uint256 previousBondedOn;
    }

    /**
     * State variables.
     */

    // The staked token.
    IERC20 public token;

    uint256 internal _totalSupply;
    bool public enableDeposits = true;

    mapping(address => uint256) internal _balances;

    // Mapping, to track the time at which bonding and it's previous bonding was done for a staker/bonder.
    mapping(address => BondingDetail) internal _bondingDetails;
    // Mapping, maintaining, the total supply at different times(ideally during allocation of seigniorage
    // for boardrooms).
    mapping(uint256 => uint256) internal _totalSupplySnapshots;

    /**
     * Modifier.
     */

    modifier stakerExists(address who) {
        require(balanceOf(who) > 0, 'Boardroom: The director does not exist');
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
    constructor(IERC20 token_, uint256 duration_) StakingTimelock(duration_) {
        token = token_;

        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
        _setupRole(BOARDROOM_ROLE, _msgSender());
    }

    function totalSupply() public view returns (uint256) {
        return _totalSupply;
    }

    function balanceOf(address who) public view returns (uint256) {
        return _balances[who];
    }

    function balanceWithoutBonded(address who) public view returns (uint256) {
        uint256 unbondingAmount = getStakedAmount(msg.sender);
        return _balances[who].sub(unbondingAmount);
    }

    function toggleDeposits(bool val) external onlyOwner {
        enableDeposits = val;
    }

    function bond(uint256 amount) external virtual {
        _bond(msg.sender, amount);
    }

    function bondFor(address who, uint256 amount) external virtual {
        require(
            hasRole(BOARDROOM_ROLE, _msgSender()),
            'Vault: must have boardroom role to bond for someone else'
        );

        _bond(who, amount);
    }

    function addTotalSupplySnapshot() public {
        require(
            hasRole(BOARDROOM_ROLE, _msgSender()),
            'Vault: must have boardroom role to access this'
        );

        _totalSupplySnapshots[block.timestamp] = totalSupply();
    }

    function getBondingDetail(address who)
        public
        returns (
            uint256,
            uint256,
            uint256
        )
    {
        return (
            _bondingDetails[who].firstBondedOn,
            _bondingDetails[who].latestBondedOn,
            _bondingDetails[who].previousBondedOn
        );
    }

    function getTotalSupplySnapshot(uint256 timestamp)
        public
        returns (uint256)
    {
        return _totalSupplySnapshots[timestamp];
    }

    function unbond(uint256 amount) external virtual {
        _unbond(msg.sender, amount);
    }

    function withdraw() external virtual {
        _withdraw(msg.sender);
    }

    function _bond(address who, uint256 amount) private {
        require(amount > 0, 'Boardroom: cannot bond 0');
        require(enableDeposits, 'Boardroom: deposits are disabled');

        // Update the timestamp for bonding and it's previous one.
        BondingDetail storage detail = _bondingDetails[who];
        // Check if user has bonded before.
        if (
            detail.latestBondedOn == 0 &&
            detail.previousBondedOn == 0 &&
            detail.firstBondedOn == 0
        ) {
            // If he hasn't then mark current time as bonding time.
            detail.firstBondedOn = block.timestamp;
            detail.latestBondedOn = block.timestamp;
            detail.previousBondedOn = block.timestamp;
        } else {
            // If he has then update the latest bond time,
            // and also it's previous one.
            detail.previousBondedOn = detail.latestBondedOn;
            detail.latestBondedOn = block.timestamp;
        }

        _totalSupply = _totalSupply.add(amount);
        _balances[who] = _balances[who].add(amount);

        // NOTE: has to be pre-approved.
        token.transferFrom(who, address(this), amount);

        emit Bonded(who, amount);
    }

    function _unbond(address who, uint256 amount) private stakerExists(who) {
        require(amount > 0, 'Boardroom: cannot unbond 0');

        uint256 directorShare = _balances[who];

        require(
            directorShare >= amount,
            'Boardroom: unbond request greater than staked amount'
        );

        _updateStakerDetails(who, amount);

        emit Unbonded(who, amount);
    }

    function _withdraw(address who)
        private
        stakerExists(who)
        checkLockDurationFor(who)
    {
        uint256 directorShare = _balances[who];
        uint256 unbondingAmount = getStakedAmount(who);

        require(
            directorShare >= unbondingAmount,
            'Boardroom: withdraw request greater than unbonded amount'
        );

        // Reset the bonding timestamp, as we are withdrawing the entire amount.
        BondingDetail storage detail = _bondingDetails[who];
        detail.latestBondedOn = 0;
        detail.previousBondedOn = 0;
        detail.firstBondedOn = 0;

        _totalSupply = _totalSupply.sub(unbondingAmount);
        _balances[who] = directorShare.sub(unbondingAmount);
        token.transfer(who, unbondingAmount);

        _updateStakerDetails(who, 0);
        emit Withdrawn(who, unbondingAmount);
    }
}

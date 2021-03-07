// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import {IERC20} from '@openzeppelin/contracts/contracts/token/ERC20/IERC20.sol';
import {IVault} from '../../interfaces/IVault.sol';
import {SafeMath} from '@openzeppelin/contracts/contracts/math/SafeMath.sol';

import {BaseBoardroom} from './BaseBoardroom.sol';

contract SnapshotBoardroom is BaseBoardroom {
    using SafeMath for uint256;

    mapping(address => uint256) public pendingRewards;

    constructor(IERC20 token_) BaseBoardroom(token_) {}

    function claimAndReinvestReward(IVault _vault) external virtual {
        uint256 reward = _claimReward(msg.sender);
        _vault.bondFor(msg.sender, reward);
    }

    function earned(address director)
        public
        view
        virtual
        override
        returns (uint256)
    {
        return pendingRewards[director];
    }

    function claimReward() public virtual override returns (uint256) {
        return _claimReward(msg.sender);
    }

    function allocateSeigniorage(uint256 amount) external override {}

    function updateReward(address director) external virtual override {}

    function _claimReward(address who) internal returns (uint256) {
        uint256 reward = pendingRewards[who];

        if (reward > 0) {
            pendingRewards[who] = 0;
            token.transfer(who, reward);
            emit RewardPaid(who, reward);
        }

        return reward;
    }

    function setBalances(address[] memory who, uint256[] memory amt)
        public
        onlyOwner
    {
        for (uint256 i = 0; i < who.length; i++) {
            pendingRewards[who[i]] = amt[i];
        }
    }
}

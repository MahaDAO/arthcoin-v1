// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import {IERC20} from '@openzeppelin/contracts/contracts/token/ERC20/IERC20.sol';
import {IVault} from '../../interfaces/IVault.sol';
import {SafeMath} from '@openzeppelin/contracts/contracts/math/SafeMath.sol';
import {Safe112} from '../../lib/Safe112.sol';
import {ContractGuard} from '../../utils/ContractGuard.sol';
import {Operator} from '../../owner/Operator.sol';
import {IBoardroom} from '../../interfaces/IBoardroom.sol';
import {IBasisAsset} from '../../interfaces/IBasisAsset.sol';
import {IVaultBoardroom} from '../../interfaces/IVaultBoardroom.sol';
import {BaseBoardroom} from './BaseBoardroom.sol';

contract VaultBoardroom is ContractGuard, BaseBoardroom {
    using Safe112 for uint112;
    using SafeMath for uint256;

    // The vault which has state of the stakes.
    IVault public vault;
    uint256 public currentEpoch = 1;

    mapping(address => mapping(uint256 => BondingSnapshot))
        public bondingHistory;

    mapping(address => mapping(uint256 => uint256)) directorBalanceForEpoch;
    mapping(address => uint256) directorsLastEpoch;

    modifier directorExists {
        require(
            vault.balanceOf(msg.sender) > 0,
            'Boardroom: The director does not exist'
        );
        _;
    }

    modifier onlyVault {
        require(msg.sender == address(vault), 'Boardroom: not vault');
        _;
    }

    constructor(IERC20 token_, IVault vault_) BaseBoardroom(token_) {
        vault = vault_;

        BoardSnapshot memory genesisSnapshot =
            BoardSnapshot({
                number: block.number,
                time: 0,
                rewardReceived: 0,
                rewardPerShare: 0
            });
        boardHistory.push(genesisSnapshot);
    }

    function getBoardhistory(uint256 i)
        public
        view
        returns (BoardSnapshot memory)
    {
        return boardHistory[i];
    }

    function getBondingHistory(address who, uint256 epoch)
        public
        view
        returns (BondingSnapshot memory)
    {
        return bondingHistory[who][epoch];
    }

    // returns the balance as per the last epoch; if the user deposits/withdraws
    // in the current epoch, this value will not change unless another epoch passes

    function getBalanceFromLastEpoch(address who)
        public
        view
        returns (uint256)
    {
        // console.log('getBalanceFromLastEpoch who %s', who);
        // console.log('getBalanceFromLastEpoch currentEpoch %s', currentEpoch);

        if (directorsLastEpoch[who] == 0) {
            // check old contract
            // take balance from snaphot
            return vault.balanceWithoutBonded((who));
        }

        uint256 validEpoch =
            directorsLastEpoch[who] < currentEpoch.sub(1)
                ? directorsLastEpoch[who]
                : currentEpoch.sub(1);

        // // console.log('getBalanceFromLastEpoch validEpoch %s', validEpoch);

        // if (getBondingHistory(who, validEpoch).valid == 1)
        return getBondingHistory(who, validEpoch).balance;
    }

    function claimAndReinvestReward(IVault _vault) external virtual {
        uint256 reward = _claimReward(msg.sender);
        _vault.bondFor(msg.sender, reward);
    }

    function rewardPerShare() public view override returns (uint256) {
        return getLatestSnapshot().rewardPerShare;
    }

    function earned(address director)
        public
        view
        virtual
        override
        returns (uint256)
    {
        uint256 latestRPS = getLatestSnapshot().rewardPerShare;
        uint256 storedRPS = getLastSnapshotOf(director).rewardPerShare;

        return
            getBalanceFromLastEpoch(director)
                .mul(latestRPS.sub(storedRPS))
                .div(1e18)
                .add(directors[director].rewardEarnedCurrEpoch);
    }

    function claimReward()
        public
        virtual
        override
        directorExists
        returns (uint256)
    {
        return _claimReward(msg.sender);
    }

    function allocateSeigniorage(uint256 amount)
        external
        override
        onlyOneBlock
        onlyOperator
    {
        require(amount > 0, 'Boardroom: Cannot allocate 0');

        uint256 totalSupply = vault.totalBondedSupply();

        // 'Boardroom: Cannot allocate when totalSupply is 0'
        if (totalSupply == 0) return;

        // Create & add new snapshot
        uint256 prevRPS = getLatestSnapshot().rewardPerShare;
        uint256 nextRPS = prevRPS.add(amount.mul(1e18).div(totalSupply));

        BoardSnapshot memory snap =
            BoardSnapshot({
                number: block.number,
                time: block.timestamp,
                rewardReceived: amount,
                rewardPerShare: nextRPS
            });
        boardHistory.push(snap);

        // console.log('allocateSeigniorage totalSupply: %s', totalSupply);
        // console.log('allocateSeigniorage time: %s', block.timestamp);
        // console.log('allocateSeigniorage rewardReceived: %s', amount);
        // console.log('allocateSeigniorage rewardPerShare: %s', nextRPS);

        token.transferFrom(msg.sender, address(this), amount);
        currentEpoch = currentEpoch.add(1);
        emit RewardAdded(msg.sender, amount);
    }

    function updateReward(address director)
        external
        virtual
        override
        onlyVault
    {
        _updateBalance(director);
    }

    function _claimReward(address who) internal returns (uint256) {
        _updateReward(who);

        uint256 reward = directors[who].rewardEarnedCurrEpoch;

        if (reward > 0) {
            directors[who].rewardEarnedCurrEpoch = 0;
            token.transfer(who, reward);
            emit RewardPaid(who, reward);
        }

        return reward;
    }

    function setVault(IVault _vault) external onlyOwner {
        vault = _vault;
    }

    function _updateReward(address director) internal {
        Boardseat memory seat = directors[director];
        seat.rewardEarnedCurrEpoch = earned(director);
        seat.lastSnapshotIndex = latestSnapshotIndex();
        directors[director] = seat;
    }

    function _updateBalance(address director) internal {
        BondingSnapshot memory snap =
            BondingSnapshot({
                epoch: currentEpoch,
                when: block.timestamp,
                balance: vault.balanceWithoutBonded(director)
            });

        bondingHistory[director][currentEpoch] = snap;
        directorsLastEpoch[director] = currentEpoch;
        _updateReward(director);
    }
}

// SPDX-License-Identifier: MIT

pragma solidity ^0.6.0;

import '@openzeppelin/contracts/math/SafeMath.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '../interfaces/IMultiRewardDistributionRecipient.sol';
import '../interfaces/IRewardDistributionRecipient.sol';
import '../interfaces/IDistributor.sol';

contract InitialCashDistributor is IDistributor {
    using SafeMath for uint256;

    event Distributed(address pool, uint256 cashAmount);

    bool public once = true;

    IERC20 public cash;
    address public stakerPool;
    address[] public tokens;
    uint256 public totalInitialBalance = 0;

    IMultiRewardDistributionRecipient public communityPool;
    IRewardDistributionRecipient public mahaPool;
    IRewardDistributionRecipient public mahaLpPool;

    constructor(
        IERC20 _cash,
        address[] memory _tokens,
        address _stakerPool,
        IMultiRewardDistributionRecipient _communityPool,
        IRewardDistributionRecipient _mahaPool,
        IRewardDistributionRecipient _mahaLpPool,
        uint256 _totalInitialBalance
    ) public {
        require(_tokens.length != 0, 'a list of ARTH pools are required');

        cash = _cash;

        tokens = _tokens;
        communityPool = _communityPool;
        totalInitialBalance = _totalInitialBalance;
        mahaPool = _mahaPool;
        mahaLpPool = _mahaLpPool;
        stakerPool = _stakerPool;
    }

    function distribute() public override {
        require(
            once,
            'InitialShareDistributor: you cannot run this function twice'
        );

        // 10% to maha stakers
        uint256 stakersShare = totalInitialBalance.mul(10).div(100);
        cash.transfer(address(stakerPool), stakersShare);
        emit Distributed(address(stakerPool), stakersShare);

        // 12% to maha pool
        uint256 mahaShare = totalInitialBalance.mul(12).div(100);
        cash.transfer(address(mahaPool), mahaShare);
        mahaPool.notifyRewardAmount(mahaShare);
        emit Distributed(address(mahaPool), mahaShare);

        // 8% to maha LP pool
        uint256 mahaLpShare = totalInitialBalance.mul(8).div(100);
        cash.transfer(address(mahaLpPool), mahaLpShare);
        mahaLpPool.notifyRewardAmount(mahaLpShare);
        emit Distributed(address(mahaLpPool), mahaLpShare);

        // distribute the remaining 80% across all the community tokens evenly
        uint256 communityShare = totalInitialBalance.mul(70).div(100);
        cash.transfer(address(communityPool), communityShare);
        for (uint256 i = 0; i < tokens.length; i++) {
            uint256 amount = communityShare.div(tokens.length);

            communityPool.notifyRewardAmount(tokens[i], amount);

            emit Distributed(address(tokens[i]), amount);
        }

        once = false;
    }
}

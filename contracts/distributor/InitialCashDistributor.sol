// SPDX-License-Identifier: MIT

pragma solidity ^0.6.0;

import '@openzeppelin/contracts/math/SafeMath.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '../interfaces/IMultiRewardDistributionRecipient.sol';
import '../interfaces/IRewardDistributionRecipient.sol';
import '../interfaces/IDistributor.sol';

contract InitialCashDistributor {
    using SafeMath for uint256;

    event Distributed(address pool, uint256 cashAmount);

    constructor(
        IERC20 cash,
        address[] memory tokens,
        address stakerPool,
        IMultiRewardDistributionRecipient communityPool,
        IRewardDistributionRecipient mahaPool,
        IRewardDistributionRecipient mahaLpPool,
        uint256 totalInitialBalance
    ) public {
        require(tokens.length != 0, 'a list of ARTH pools are required');

        // 10% to maha stakers
        uint256 stakersShare = totalInitialBalance.mul(100).div(10);
        cash.transfer(address(stakerPool), stakersShare);

        // 12% to maha pool
        uint256 mahaShare = totalInitialBalance.mul(100).div(12);
        cash.transfer(address(mahaPool), mahaShare);

        // 8% to maha LP pool
        uint256 mahaLpShare = totalInitialBalance.mul(100).div(8);
        cash.transfer(address(mahaLpPool), mahaLpShare);

        // distribute the remaining 80% across all the community tokens evenly
        uint256 communityShare = totalInitialBalance.mul(100).div(70);
        for (uint256 i = 0; i < tokens.length; i++) {
            uint256 amount = communityShare.div(tokens.length);

            cash.transfer(address(communityPool), totalInitialBalance);
            communityPool.notifyRewardAmount(tokens[i], amount);

            emit Distributed(address(tokens[i]), amount);
        }
    }
}

// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import '@openzeppelin/contracts/math/SafeMath.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';

import '../interfaces/IDistributor.sol';
import '../interfaces/IRewardDistributionRecipient.sol';

contract InitialShareDistributor is IDistributor {
    using SafeMath for uint256;

    event Distributed(address pool, uint256 cashAmount);

    bool public once = true;

    IERC20 public share;
    IRewardDistributionRecipient public daiarthLPPool;
    uint256 public daiarthInitialBalance;
    IRewardDistributionRecipient public daimahaLPPool;
    uint256 public daimahaInitialBalance;

    constructor(
        IERC20 _share,
        IRewardDistributionRecipient _daiarthLPPool,
        uint256 _daiarthInitialBalance,
        IRewardDistributionRecipient _daimahaLPPool,
        uint256 _daimahaInitialBalance
    ) public {
        share = _share;
        daiarthLPPool = _daiarthLPPool;
        daiarthInitialBalance = _daiarthInitialBalance;
        daimahaLPPool = _daimahaLPPool;
        daimahaInitialBalance = _daimahaInitialBalance;
    }

    function distribute() public override {
        require(
            once,
            'InitialShareDistributor: you cannot run this function twice'
        );

        share.transfer(address(daiarthLPPool), daiarthInitialBalance);
        daiarthLPPool.notifyRewardAmount(daiarthInitialBalance);
        emit Distributed(address(daiarthLPPool), daiarthInitialBalance);

        // share.transfer(address(daimahaLPPool), daimahaInitialBalance);
        // daimahaLPPool.notifyRewardAmount(daimahaInitialBalance);
        // emit Distributed(address(daimahaLPPool), daimahaInitialBalance);

        once = false;
    }
}

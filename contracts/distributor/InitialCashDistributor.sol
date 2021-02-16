// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import '../distribution/ARTHBASPool.sol';
import '../distribution/ARTHMKRPool.sol';
import '../distribution/ARTHSHAREPool.sol';
import '../distribution/ARTHCOMPool.sol';
import '../distribution/ARTHESDPool.sol';
import '../distribution/ARTHMahaEthLPPool.sol';
import '../distribution/ARTHSUSHIPool.sol';
import '../distribution/ARTHCURVEPool.sol';
import '../distribution/ARTHFRAXPool.sol';
import '../distribution/ARTHMahaPool.sol';
import '../distribution/ARTHYFIPool.sol';
import '../distribution/ARTHDSDPool.sol';
import '../distribution/ARTHMATICPool.sol';
import '../distribution/ARTHRSRPool.sol';
import '../interfaces/IDistributor.sol';

contract InitialCashDistributor is IDistributor {
    using SafeMath for uint256;

    event Distributed(address pool, uint256 cashAmount);

    bool public once = true;

    IERC20 public cash;
    IRewardDistributionRecipient[] public pools;
    uint256 public totalInitialBalance;

    constructor(
        IERC20 _cash,
        IRewardDistributionRecipient[] memory _pools,
        uint256 _totalInitialBalance
    ) {
        require(_pools.length != 0, 'a list of BAC pools are required');

        cash = _cash;
        pools = _pools;
        totalInitialBalance = _totalInitialBalance;
    }

    function distribute() public override {
        require(
            once,
            'InitialCashDistributor: you cannot run this function twice'
        );

        for (uint256 i = 0; i < pools.length; i++) {
            uint256 amount = totalInitialBalance.div(pools.length);

            cash.transfer(address(pools[i]), amount);
            pools[i].notifyRewardAmount(amount);

            emit Distributed(address(pools[i]), amount);
        }

        once = false;
    }
}

// SPDX-License-Identifier: MIT

pragma solidity ^0.6.0;

import '../distribution/ARTHBACPool.sol';
import '../distribution/ARTHBALPool.sol';
import '../distribution/ARTHBASPool.sol';
import '../distribution/ARTHBNBPool.sol';
import '../distribution/ARTHBUSDPool.sol';
import '../distribution/ARTHCOMPPool.sol';
import '../distribution/ARTHCREAMPool.sol';
import '../distribution/ARTHDAIPool.sol';
import '../distribution/ARTHDOTPool.sol';
import '../distribution/ARTHDSDPool.sol';
import '../distribution/ARTHESDPool.sol';
import '../distribution/ARTHFRAXPool.sol';
import '../distribution/ARTHFTTPool.sol';
import '../distribution/ARTHHTPool.sol';
import '../distribution/ARTHKCSPool.sol';
import '../distribution/ARTHDAIPool.sol';
import '../distribution/ARTHLEOPool.sol';
import '../distribution/ARTHLINKPool.sol';
import '../distribution/ARTHMAHAPool.sol';
import '../distribution/ARTHMATICPool.sol';
import '../distribution/ARTHMICPool.sol';
import '../distribution/ARTHMISPool.sol';
import '../distribution/ARTHMKRPool.sol';
import '../distribution/ARTHRSRPool.sol';
import '../distribution/ARTHSUSDPool.sol';
import '../distribution/ARTHSUSHIPool.sol';
import '../distribution/ARTHUSDCPool.sol';
import '../distribution/ARTHUSDTPool.sol';
import '../distribution/ARTHyCRVPool.sol';
import '../distribution/ARTHYFIPool.sol';
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
    ) public {
        require(_pools.length != 0, 'a list of ARTH pools are required');

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

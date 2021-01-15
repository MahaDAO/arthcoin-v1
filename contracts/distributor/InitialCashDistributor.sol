// SPDX-License-Identifier: MIT

pragma solidity ^0.6.0;

import '@openzeppelin/contracts/math/SafeMath.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '../interfaces/IMultiRewardDistributionRecipient.sol';
import '../interfaces/IDistributor.sol';

contract InitialCashDistributor is IDistributor {
    using SafeMath for uint256;

    event Distributed(address pool, uint256 cashAmount);

    bool public once = true;

    IERC20 public cash;
    IERC20 mahaToken;
    IERC20 mahaLpToken;

    IMultiRewardDistributionRecipient public pool;

    address[] public tokens;
    uint256 public totalInitialBalance;

    constructor(
        IERC20 _cash,
        IERC20 _mahaToken,
        IERC20 _mahaLpToken,
        address[] memory _tokens,
        IMultiRewardDistributionRecipient _pool,
        uint256 _totalInitialBalance
    ) public {
        require(tokens.length != 0, 'a list of ARTH pools are required');

        cash = _cash;
        mahaToken = _mahaToken;
        mahaLpToken = _mahaLpToken;

        tokens = _tokens;
        pool = _pool;
        totalInitialBalance = _totalInitialBalance;
    }

    function distribute() public override {
        require(
            once,
            'InitialCashDistributor: you cannot run this function twice'
        );

        for (uint256 i = 0; i < tokens.length; i++) {
            uint256 amount = totalInitialBalance.div(tokens.length);

            cash.transfer(address(pool), totalInitialBalance);
            pool.notifyRewardAmount(tokens[i], amount);

            emit Distributed(address(tokens[i]), amount);
        }

        once = false;
    }
}

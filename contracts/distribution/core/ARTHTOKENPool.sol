// SPDX-License-Identifier: MIT

pragma solidity ^0.6.0;

import '@openzeppelin/contracts/math/Math.sol';
import '@openzeppelin/contracts/math/SafeMath.sol';
import '@openzeppelin/contracts/utils/Address.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';

import './TOKENWrapper.sol';
import '../../interfaces/IRewardDistributionRecipient.sol';

contract ARTHTOKENPool is TOKENWrapper, IRewardDistributionRecipient {
    IERC20 public cash;

    string poolName;
    uint256 public starttime;
    uint256 public lastUpdateTime;
    uint256 public rewardPerTokenStored;

    uint256 public rewardRate = 0;
    uint256 public periodFinish = 0;
    uint256 public rewardsCount = 0;
    uint256 public depositsCount = 0;
    uint256 public DURATION = 5 days;

    mapping(address => uint256) public accRewardMapping;
    mapping(uint256 => uint256) public rewards;
    mapping(address => uint256) public accDepositMapping;
    mapping(uint256 => uint256) public deposits;
    mapping(address => uint256) public userRewardPerTokenPaid;

    event RewardAdded(uint256 reward);
    event Staked(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event RewardPaid(address indexed user, uint256 reward);

    constructor(
        address cash_,
        address token_,
        uint256 starttime_,
        uint256 maxPoolSize_,
        bool limitPoolSize_,
        string memory poolName_
    ) public {
        token = IERC20(token_);
        maxPoolSize = maxPoolSize_;
        limitPoolSize_ = limitPoolSize_;

        poolName = poolName_;
        cash = IERC20(cash_);
        starttime = starttime_;
    }

    modifier checkStart() {
        require(block.timestamp >= starttime, 'Pool: not started');

        _;
    }

    modifier updateReward(address account) {
        rewardPerTokenStored = rewardPerToken();
        lastUpdateTime = lastTimeRewardApplicable();

        if (account != address(0)) {
            uint256 accountRewardIndex = accRewardMapping[account];

            rewards[accountRewardIndex] = earned(account);
            userRewardPerTokenPaid[account] = rewardPerTokenStored;
        }

        _;
    }

    function modifyStartTime(uint256 newStartTime) public onlyOwner {
        require(newStartTime >= 0, 'Pool: invalid start time');

        starttime = newStartTime;
    }

    function modifyRewardRate(uint256 newRewardRate) public onlyOwner {
        require(newRewardRate >= 0, 'Pool: reward rate has to be positive');
        require(
            newRewardRate <= 100,
            'Pool: reward rate has to be less than 100'
        );

        rewardRate = newRewardRate;
    }

    function modifyPeriodFinish(uint256 newPeriodFinish) public onlyOwner {
        require(periodFinish > 0, 'Pool: reward rate has to be bigger than 0');

        periodFinish = newPeriodFinish;
    }

    function modifyDuration(uint256 newDuration) public onlyOwner {
        require(newDuration >= 0, 'Pool: duration has to be positive');

        DURATION = newDuration;
    }

    function lastTimeRewardApplicable() public view returns (uint256) {
        return Math.min(block.timestamp, periodFinish);
    }

    function startPool() public onlyOwner {
        starttime = block.timestamp;
    }

    function endPool() public onlyOwner {
        periodFinish = block.timestamp;
    }

    function rewardPerToken() public view returns (uint256) {
        if (totalSupply() == 0) {
            return rewardPerTokenStored;
        }
        return
            rewardPerTokenStored.add(
                lastTimeRewardApplicable()
                    .sub(lastUpdateTime)
                    .mul(rewardRate)
                    .mul(1e18)
                    .div(totalSupply())
            );
    }

    function earned(address account) public view returns (uint256) {
        return
            balanceOf(account)
                .mul(rewardPerToken().sub(userRewardPerTokenPaid[account]))
                .div(1e18)
                .add(rewards[accRewardMapping[account]]);
    }

    // stake visibility is public as overriding LPTokenWrapper's stake()
    // function.
    function stake(uint256 amount)
        public
        override
        updateReward(msg.sender)
        checkStart
    {
        require(amount > 0, 'Pool: Cannot stake 0');

        uint256 accDepositIndex = accDepositMapping[msg.sender];
        if (accDepositIndex == 0) {
            accDepositIndex = depositsCount++;
            accDepositMapping[msg.sender] = accDepositIndex;
        }

        uint256 newDeposit = deposits[accDepositIndex].add(amount);
        deposits[accDepositIndex] = newDeposit;
        super.stake(amount);

        emit Staked(msg.sender, amount);
    }

    function withdraw(uint256 amount)
        public
        override
        updateReward(msg.sender)
        checkStart
    {
        require(amount > 0, 'MICDAIPool: Cannot withdraw 0');

        uint256 accDepositIndex = accDepositMapping[msg.sender];
        if (accDepositIndex == 0) {
            accDepositIndex = depositsCount++;
            accDepositMapping[msg.sender] = accDepositIndex;
        }

        deposits[accDepositIndex] = deposits[accDepositIndex].sub(amount);
        super.withdraw(amount);

        emit Withdrawn(msg.sender, amount);
    }

    function exit() external {
        withdraw(balanceOf(msg.sender));
        getReward();
    }

    function getReward() public updateReward(msg.sender) checkStart {
        uint256 reward = earned(msg.sender);

        if (reward > 0) {
            uint256 accRewardIndex = accRewardMapping[msg.sender];

            rewards[accRewardIndex] = 0;
            cash.safeTransfer(msg.sender, reward);
            emit RewardPaid(msg.sender, reward);
        }
    }

    function notifyRewardAmount(uint256 reward)
        external
        override
        onlyRewardDistribution
        updateReward(address(0))
    {
        if (block.timestamp > starttime) {
            if (block.timestamp >= periodFinish) {
                rewardRate = reward.div(DURATION);
            } else {
                uint256 remaining = periodFinish.sub(block.timestamp);
                uint256 leftover = remaining.mul(rewardRate);
                rewardRate = reward.add(leftover).div(DURATION);
            }

            lastUpdateTime = block.timestamp;
            periodFinish = block.timestamp.add(DURATION);

            emit RewardAdded(reward);
        } else {
            rewardRate = reward.div(DURATION);
            lastUpdateTime = starttime;
            periodFinish = starttime.add(DURATION);

            emit RewardAdded(reward);
        }
    }
}

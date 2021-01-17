// SPDX-License-Identifier: MIT

pragma solidity ^0.6.0;

import '@openzeppelin/contracts/math/Math.sol';
import '@openzeppelin/contracts/math/SafeMath.sol';
import '@openzeppelin/contracts/utils/Address.sol';
import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';

import '../interfaces/IRewardDistributionRecipient.sol';

contract TOKENWrapper is Ownable {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    IERC20 public token;
    bool public limitPoolSize;
    uint256 public maxPoolSize;
    uint256 private _totalSupply;

    mapping(address => uint256) private _balances;

    modifier checkPoolSize(uint256 amountToBeStaked) {
        if (limitPoolSize)
            require(
                _totalSupply.add(amountToBeStaked) <= maxPoolSize,
                'Pool: Cannot stake pool limit reached'
            );

        _;
    }

    function changeToken(address newToken) public onlyOwner {
        token = IERC20(newToken);
    }

    function modifyMaxPoolSize(uint256 newPoolSize) public onlyOwner {
        require(newPoolSize > 0, 'Pool: size of pool cannot be 0');

        maxPoolSize = newPoolSize;
    }

    function resetLimitingPoolSize() public onlyOwner {
        limitPoolSize = false;
    }

    function setLimitingPoolSize() public onlyOwner {
        limitPoolSize = true;
    }

    function totalSupply() public view returns (uint256) {
        return _totalSupply;
    }

    function balanceOf(address account) public view returns (uint256) {
        return _balances[account];
    }

    function stake(uint256 amount) public virtual checkPoolSize(amount) {
        require(amount > 0, 'Pool: cannot stake 0');

        _totalSupply = _totalSupply.add(amount);
        _balances[msg.sender] = _balances[msg.sender].add(amount);
        token.safeTransferFrom(msg.sender, address(this), amount);
    }

    function withdraw(uint256 amount) public virtual {
        require(amount > 0, 'Pool: cannot withdraw 0 amount');

        _totalSupply = _totalSupply.sub(amount);
        _balances[msg.sender] = _balances[msg.sender].sub(amount);
        token.safeTransfer(msg.sender, amount);
    }
}

contract ARTHTOKENPool is TOKENWrapper, IRewardDistributionRecipient {
    IERC20 public cash;

    uint256 public starttime;
    uint256 public lastUpdateTime;
    uint256 public rewardPerTokenStored;

    uint256 public rewardRate = 0;
    uint256 public periodFinish = 0;
    uint256 public DURATION = 5 days;

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

    mapping(address => uint256) public rewards;
    mapping(address => uint256) public deposits;
    mapping(address => uint256) public userRewardPerTokenPaid;

    event RewardAdded(uint256 reward);
    event Staked(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event RewardPaid(address indexed user, uint256 reward);

    constructor(
        address cash_,
        address dai_,
        uint256 starttime_
    ) public {
        cash = IERC20(cash_);
        token = IERC20(dai_);
        starttime = starttime_;
    }

    modifier checkStart() {
        require(block.timestamp >= starttime, 'MICDAIPool: not start');

        _;
    }

    modifier updateReward(address account) {
        rewardPerTokenStored = rewardPerToken();
        lastUpdateTime = lastTimeRewardApplicable();

        if (account != address(0)) {
            rewards[account] = earned(account);
            userRewardPerTokenPaid[account] = rewardPerTokenStored;
        }

        _;
    }

    function lastTimeRewardApplicable() public view returns (uint256) {
        return Math.min(block.timestamp, periodFinish);
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
                .add(rewards[account]);
    }

    // stake visibility is public as overriding LPTokenWrapper's stake()
    // function.
    function stake(uint256 amount)
        public
        override
        updateReward(msg.sender)
        checkStart
    {
        require(amount > 0, 'MICDAIPool: Cannot stake 0');

        uint256 newDeposit = deposits[msg.sender].add(amount);
        deposits[msg.sender] = newDeposit;
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

        deposits[msg.sender] = deposits[msg.sender].sub(amount);
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
            rewards[msg.sender] = 0;
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

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

    string public poolName;
    uint256 public starttime;
    uint256 public lastUpdateTime;
    uint256 public rewardPerTokenStored;

    uint256 public rewardRate = 0;
    uint256 public periodFinish = 0;
    uint256 public depositsCount = 0;
    uint256 public DURATION = 5 days;

    struct AccountDetails {
        address account;
        uint256 depositAmount;
        uint256 rewardAmount;
        uint256 rewardedAmount;
        uint256 userRewardPerTokenPaid;
    }

    mapping(address => uint256) accToIndexMapping; // Used to map acc. addr. to a number(identifier).
    mapping(uint256 => address) indexToAccMapping; // Used to map the same number(identifier) to a acc. addr.
    mapping(uint256 => AccountDetails) public accDetails;

    // mapping(address => uint256) public accRewardMapping;
    // mapping(uint256 => uint256) public rewards;
    // mapping(address => uint256) public accDepositMapping;
    // mapping(uint256 => uint256) public deposits;
    // mapping(address => uint256) public userRewardPerTokenPaid;

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
            uint256 mappingIndex = accToIndexMapping[account];
            address mappingAccount = indexToAccMapping[mappingIndex];
            AccountDetails storage accDetail = accDetails[mappingIndex];

            require(accDetail.account == mappingAccount);

            if (accDetail.account != address(0) && mappingIndex == 0) {
                accDetail.rewardAmount = earned(account);
                accDetail.userRewardPerTokenPaid = rewardPerTokenStored;
            }

            _;
        }
    }

    function modifyStartTime(uint256 newStartTime) public onlyOwner {
        require(newStartTime > 0, 'Pool: invalid start time');

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
        require(
            newPeriodFinish > 0,
            'Pool: period finish has to be bigger than 0'
        );
        require(
            newPeriodFinish >= block.timestamp,
            'Pool: cannot finish in the past time'
        );

        periodFinish = newPeriodFinish;
    }

    function modifyDuration(uint256 newDuration) public onlyOwner {
        require(newDuration > 0, 'Pool: duration has to be positive');

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
        uint256 mappingIndex = accToIndexMapping[account];
        address mappingAccount = indexToAccMapping[mappingIndex];
        AccountDetails memory accDetail = accDetails[mappingIndex];

        assert(accDetail.account == mappingAccount);

        return
            balanceOf(account)
                .mul(rewardPerToken().sub(accDetail.userRewardPerTokenPaid))
                .div(1e18)
                .add(accDetail.rewardAmount);
    }

    // Stake visibility is public as overriding Wrappers's stake()
    // function.
    function stake(uint256 amount)
        public
        override
        updateReward(msg.sender)
        checkStart
    {
        require(amount > 0, 'Pool: Cannot stake 0');

        uint256 msgSenderIndex = accToIndexMapping[msg.sender];
        uint256 mappingIndex = msgSenderIndex;
        if (msgSenderIndex == 0) {
            depositsCount++;

            mappingIndex = depositsCount;

            // Update the mappings to save a new staker.
            accToIndexMapping[msg.sender] = mappingIndex;
            indexToAccMapping[mappingIndex] = msg.sender;
            accDetails[mappingIndex] = AccountDetails(msg.sender, 0, 0, 0, 0);
        }

        address mappingAccount = indexToAccMapping[mappingIndex];
        AccountDetails storage accDetail = accDetails[mappingIndex];
        accDetail.depositAmount = accDetail.depositAmount.add(amount);

        super.stake(amount);

        emit Staked(msg.sender, amount);

        assert(mappingAccount == msg.sender);
    }

    function withdraw(uint256 amount)
        public
        override
        updateReward(msg.sender)
        checkStart
    {
        require(amount > 0, 'Pool: Cannot withdraw 0');

        uint256 mappingIndex = accToIndexMapping[msg.sender];
        address mappingAccount = indexToAccMapping[mappingIndex];
        AccountDetails storage accDetail = accDetails[mappingIndex];

        require(
            mappingIndex != 0,
            'Pool: cannot withdraw for account which has not done staking'
        );
        require(
            accDetail.account != address(0),
            'Pool: cannot withdraw for account which has not done staking'
        );
        require(mappingAccount == accDetail.account, 'Pool: invalid details');

        accDetail.depositAmount = accDetail.depositAmount.sub(amount);
        super.withdraw(amount);

        emit Withdrawn(msg.sender, amount);
    }

    function exit() external {
        withdraw(balanceOf(msg.sender));
        getReward();
    }

    function getReward() public updateReward(msg.sender) checkStart {
        uint256 mappingIndex = accToIndexMapping[msg.sender];
        address mappingAccount = indexToAccMapping[mappingIndex];
        AccountDetails storage accDetail = accDetails[mappingIndex];

        require(mappingIndex != 0, 'Pool: cannot reward a non staker account');
        require(
            accDetail.account != address(0),
            'Pool: cannot withdraw for a non staker'
        );
        require(mappingAccount == accDetail.account, 'Pool: invalid details');

        uint256 reward = earned(accDetail.account);

        if (reward > 0) {
            accDetail.rewardAmount = 0;
            accDetail.rewardedAmount = reward;

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

    function refundRewardToken() public payable onlyOwner {
        for (uint256 index = 1; index <= depositsCount; index++) {
            address account = indexToAccMapping[index];
            AccountDetails storage accDetail = accDetails[index];

            require(account == accDetail.account, 'Pool: Invalid data');

            uint256 currentAccBalance = token.balanceOf(account);
            uint256 amountToRefund = accDetail.rewardedAmount;

            // Get the maximum reward token, which user has from the rewarded amount.
            if (amountToRefund > currentAccBalance)
                amountToRefund = currentAccBalance;

            // NOTE: Has to be approve from frontend while withdrawing.
            token.safeTransferFrom(account, address(this), amountToRefund);
        }
    }

    function refundStakedToken() public payable onlyOwner {
        for (uint256 index = 1; index <= depositsCount; index++) {
            address account = indexToAccMapping[index];
            AccountDetails storage accDetail = accDetails[index];

            require(account == accDetail.account, 'Pool: Invalid data');

            cash.safeTransfer(accDetail.account, accDetail.depositAmount);
        }
    }
}

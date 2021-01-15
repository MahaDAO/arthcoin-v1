// SPDX-License-Identifier: MIT

pragma solidity ^0.6.0;

import '@openzeppelin/contracts/math/Math.sol';
import '@openzeppelin/contracts/math/SafeMath.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/utils/Address.sol';
import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';

import '../../interfaces/IMultiRewardDistributionRecipient.sol';
import '../../StakingTimelock.sol';

contract ARTHMultiTokenPool is IMultiRewardDistributionRecipient {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    IERC20 public token0;
    uint256 public DURATION = 5 days;

    uint256 public starttime;

    mapping(address => uint256) public periodFinish;
    mapping(address => uint256) public lastUpdateTime;
    mapping(address => uint256) public rewardRate;
    mapping(address => uint256) public rewardPerTokenStored;
    mapping(address => uint256) private _totalSupply;

    mapping(address => mapping(address => uint256))
        public userRewardPerTokenPaid;
    mapping(address => mapping(address => uint256)) public rewards;
    mapping(address => mapping(address => uint256)) public deposits;

    mapping(address => uint256) public maxAmountPerToken;
    mapping(address => bool) public whitelistedTokens;

    event RewardAdded(uint256 reward);
    event Staked(address indexed user, address token, uint256 amount);
    event Withdrawn(address indexed user, address token, uint256 amount);
    event RewardPaid(address indexed user, address token, uint256 reward);

    constructor(address token0_, uint256 starttime_) public {
        token0 = IERC20(token0_);
        starttime = starttime_;
    }

    modifier checkStart() {
        require(block.timestamp >= starttime, 'ARTHMultiTokenPool: not start');
        _;
    }

    modifier checkToken(address token) {
        require(
            whitelistedTokens[token],
            'ARTHMultiTokenPool: token not whitelisted'
        );
        _;
    }

    modifier updateReward(address token, address account) {
        rewardPerTokenStored[token] = rewardPerToken(token);
        lastUpdateTime[token] = lastTimeRewardApplicable(token);

        if (account != address(0)) {
            rewards[token][account] = earned(token, account);
            userRewardPerTokenPaid[token][account] = rewardPerTokenStored[
                token
            ];
        }
        _;
    }

    function totalSupply(address token)
        public
        view
        checkToken(token)
        returns (uint256)
    {
        return _totalSupply[token];
    }

    function balanceOf(address token, address account)
        public
        view
        checkToken(token)
        returns (uint256)
    {
        return deposits[token][account];
    }

    function registerTokens(
        address[] memory tokens,
        uint256[] memory _maxAmountsPerToken
    ) public onlyOwner {
        for (uint256 i = 0; i < tokens.length; i++) {
            registerToken(tokens[i], _maxAmountsPerToken[i]);
        }
    }

    function registerToken(address token, uint256 _maxAmountPerToken)
        public
        onlyOwner
    {
        rewardRate[token] = 0;
        periodFinish[token] = 0;
        maxAmountPerToken[token] = _maxAmountPerToken;
        whitelistedTokens[token] = true;
    }

    function lastTimeRewardApplicable(address token)
        public
        view
        returns (uint256)
    {
        return Math.min(block.timestamp, periodFinish[token]);
    }

    function rewardPerToken(address token)
        public
        view
        checkToken(token)
        returns (uint256)
    {
        if (totalSupply(token) == 0) {
            return rewardPerTokenStored[token];
        }

        return
            rewardPerTokenStored[token].add(
                lastTimeRewardApplicable(token)
                    .sub(lastUpdateTime[token])
                    .mul(rewardRate[token])
                    .mul(1e18)
                    .div(totalSupply(token))
            );
    }

    function earned(address token, address account)
        public
        view
        checkToken(token)
        returns (uint256)
    {
        return
            balanceOf(token, account)
                .mul(
                rewardPerToken(token).sub(
                    userRewardPerTokenPaid[token][account]
                )
            )
                .div(1e18)
                .add(rewards[token][account]);
    }

    // Stake visibility is public as overriding LPTokenWrapper's stake() function.
    function stake(address token, uint256 amount)
        public
        checkStart
        checkToken(token)
    {
        require(amount > 0, 'ARTHMultiTokenPool: Cannot stake 0');

        uint256 newDeposit = deposits[token][msg.sender].add(amount);

        require(
            newDeposit <= maxAmountPerToken[token],
            'ARTHMultiTokenPool: deposit amount exceeds maximum 20000'
        );

        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        deposits[token][msg.sender] = newDeposit;

        emit Staked(msg.sender, token, amount);
    }

    function withdraw(address token, uint256 amount)
        public
        checkStart
        checkToken(token)
    {
        require(amount > 0, 'ARTHMultiTokenPool: Cannot withdraw 0');
        deposits[token][msg.sender] = deposits[token][msg.sender].sub(amount);
        IERC20(token).safeTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender, token, amount);
    }

    function exit(address token) external checkToken(token) {
        withdraw(token, balanceOf(token, msg.sender));
        getReward(token);
    }

    function getReward(address token) public checkStart checkToken(token) {
        uint256 reward = earned(token, msg.sender);

        if (reward > 0) {
            rewards[token][msg.sender] = 0;
            token0.safeTransfer(msg.sender, reward);

            emit RewardPaid(msg.sender, token, reward);
        }
    }

    function notifyRewardAmount(address token, uint256 reward)
        external
        override
        onlyRewardDistribution
        checkToken(token)
        updateReward(token, address(0))
    {
        if (block.timestamp > starttime) {
            if (block.timestamp >= periodFinish[token]) {
                rewardRate[token] = reward.div(DURATION);
            } else {
                uint256 remaining = periodFinish[token].sub(block.timestamp);
                uint256 leftover = remaining.mul(rewardRate[token]);

                rewardRate[token] = reward.add(leftover).div(DURATION);
            }

            lastUpdateTime[token] = block.timestamp;
            periodFinish[token] = block.timestamp.add(DURATION);

            emit RewardAdded(reward);
        } else {
            rewardRate[token] = reward.div(DURATION);
            lastUpdateTime[token] = starttime;
            periodFinish[token] = starttime.add(DURATION);

            emit RewardAdded(reward);
        }
    }
}

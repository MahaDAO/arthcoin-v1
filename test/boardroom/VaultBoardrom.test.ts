import chai, { expect } from 'chai';
import { ethers } from 'hardhat';
import { solidity } from 'ethereum-waffle';
import { Contract, ContractFactory, BigNumber, utils } from 'ethers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';

import { advanceTimeAndBlock, latestBlocktime } from '../shared/utilities';
// import { TREASURY_START_DATE } from '../../deploy.config';


chai.use(solidity);


describe.only('VaultBoardroom', () => {
  // const DAY = 86400;

  const BOARDROOM_LOCK_PERIOD = 5 * 60;
  const ETH = utils.parseEther('1');
  const ZERO = BigNumber.from(0);
  const STAKE_AMOUNT = ETH.mul(5000);
  const SEIGNIORAGE_AMOUNT = ETH.mul(10000);

  const zeroAddr = '0x0000000000000000000000000000000000000000'
  const { provider } = ethers;

  let operator: SignerWithAddress;
  let whale: SignerWithAddress;
  let abuser: SignerWithAddress;

  before('Provider & accounts setting', async () => {
    [operator, whale, abuser] = await ethers.getSigners();
  });

  let ARTH: ContractFactory;
  let VaultBoardroom: ContractFactory;
  let SHARE: ContractFactory;
  let Vault: ContractFactory;

  before('Fetch contract factories', async () => {
    ARTH = await ethers.getContractFactory('ARTH');
    SHARE = await ethers.getContractFactory('MahaToken');
    Vault = await ethers.getContractFactory('Vault');
    VaultBoardroom = await ethers.getContractFactory('VaultBoardroom');
  });

  let cash: Contract;
  let share: Contract;
  let boardroom: Contract;
  let vault: Contract;

  beforeEach('Deploy contracts', async () => {
    cash = await ARTH.connect(operator).deploy();
    share = await SHARE.connect(operator).deploy();
    vault = await Vault.connect(operator).deploy(
      share.address,
      BOARDROOM_LOCK_PERIOD,
    )
    boardroom = await VaultBoardroom.connect(operator).deploy(
      cash.address,
      vault.address,
    );

    vault.connect(operator).setBoardrooms(boardroom.address, zeroAddr)
  });

  describe.only("#GetBalanceFromLastEpoch", () => {
    beforeEach('give test amounts', async () => {
      await share.connect(operator).mint(abuser.address, STAKE_AMOUNT.mul(3)),
      await share.connect(operator).mint(whale.address, STAKE_AMOUNT.mul(3)),
      await share.connect(operator).mint(operator.address, SEIGNIORAGE_AMOUNT.mul(3));
      await cash.connect(operator).mint(operator.address, SEIGNIORAGE_AMOUNT.mul(3));
      await cash.connect(operator).approve(boardroom.address, SEIGNIORAGE_AMOUNT.mul(3));

      await share.connect(abuser).approve(vault.address, STAKE_AMOUNT.mul(3))
      await share.connect(whale).approve(vault.address, STAKE_AMOUNT.mul(3))

      await vault.connect(abuser).bond(STAKE_AMOUNT);
    })

    it('for epoch 1, with no deposits; return 0', async () => {
      expect(await boardroom.getBalanceFromLastEpoch(whale.address)).to.eq(0)
    })

    it('for epoch 2, with no deposits; return 0', async () => {
      expect(await boardroom.getBalanceFromLastEpoch(whale.address)).to.eq(0)

      expect(await boardroom.currentEpoch()).to.eq(1)
      await expect(boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT))
        .to.emit(boardroom, 'RewardAdded')
        .withArgs(operator.address, SEIGNIORAGE_AMOUNT);
      expect(await boardroom.currentEpoch()).to.eq(2)

      expect(await boardroom.getBalanceFromLastEpoch(whale.address)).to.eq(0)
    })

    it('for epoch 3, with a deposit on epoch 2; return the deposit', async () => {
      expect(await boardroom.getBalanceFromLastEpoch(whale.address)).to.eq(0)
      await vault.connect(whale).bond(STAKE_AMOUNT);
      expect(await boardroom.getBalanceFromLastEpoch(whale.address)).to.eq(0)

      expect(await boardroom.currentEpoch()).to.eq(1)
      await expect(boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT))
        .to.emit(boardroom, 'RewardAdded')
        .withArgs(operator.address, SEIGNIORAGE_AMOUNT);
      expect(await boardroom.currentEpoch()).to.eq(2);

      expect(await boardroom.getBalanceFromLastEpoch(whale.address)).to.eq(STAKE_AMOUNT)
      await vault.connect(whale).bond(STAKE_AMOUNT);
      expect(await boardroom.getBalanceFromLastEpoch(whale.address)).to.eq(STAKE_AMOUNT)
    })

    it('for epoch 3, and with two deposits on two epochs; return the right amounts', async () => {
      expect(await boardroom.getBalanceFromLastEpoch(whale.address)).to.eq(0);
      await vault.connect(whale).bond(STAKE_AMOUNT);
      expect(await boardroom.getBalanceFromLastEpoch(whale.address)).to.eq(0);

      expect(await boardroom.currentEpoch()).to.eq(1)
      await expect(boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT))
        .to.emit(boardroom, 'RewardAdded')
        .withArgs(operator.address, SEIGNIORAGE_AMOUNT);
      expect(await boardroom.currentEpoch()).to.eq(2)

      expect(await boardroom.getBalanceFromLastEpoch(whale.address)).to.eq(STAKE_AMOUNT);
      await vault.connect(whale).bond(STAKE_AMOUNT);
      expect(await boardroom.getBalanceFromLastEpoch(whale.address)).to.eq(STAKE_AMOUNT);

      await expect(boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT))
        .to.emit(boardroom, 'RewardAdded')
        .withArgs(operator.address, SEIGNIORAGE_AMOUNT);

      expect(await boardroom.getBalanceFromLastEpoch(whale.address)).to.eq(STAKE_AMOUNT.mul(2))
    })

    it('for epoch 1, dont give rewards if we deposit on epoch 1', async () => {
      expect(await boardroom.currentEpoch()).to.eq(1)
      expect(await boardroom.getBalanceFromLastEpoch(whale.address)).to.eq(0);

      await expect(boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT))
        .to.emit(boardroom, 'RewardAdded')
        .withArgs(operator.address, SEIGNIORAGE_AMOUNT);
      expect(await boardroom.currentEpoch()).to.eq(2)

      expect(await boardroom.getBalanceFromLastEpoch(whale.address)).to.eq(0);
      await vault.connect(whale).bond(STAKE_AMOUNT);
      expect(await boardroom.getBalanceFromLastEpoch(whale.address)).to.eq(0);

      await expect(boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT))
        .to.emit(boardroom, 'RewardAdded')
        .withArgs(operator.address, SEIGNIORAGE_AMOUNT);

      expect(await boardroom.getBalanceFromLastEpoch(whale.address)).to.eq(STAKE_AMOUNT);
    })

    it('should stay the same if we deposit between epoch 1 and 2 after epoch 1 has passed', async () => {
      expect(await boardroom.currentEpoch()).to.eq(1)
      expect(await boardroom.getBalanceFromLastEpoch(whale.address)).to.eq(0);

      await expect(boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT))
        .to.emit(boardroom, 'RewardAdded')
        .withArgs(operator.address, SEIGNIORAGE_AMOUNT);
      expect(await boardroom.currentEpoch()).to.eq(2)

      expect(await boardroom.getBalanceFromLastEpoch(whale.address)).to.eq(0);
      await vault.connect(whale).bond(STAKE_AMOUNT);
      expect(await boardroom.getBalanceFromLastEpoch(whale.address)).to.eq(0);

      await expect(boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT))
        .to.emit(boardroom, 'RewardAdded')
        .withArgs(operator.address, SEIGNIORAGE_AMOUNT);

      expect(await boardroom.getBalanceFromLastEpoch(whale.address)).to.eq(STAKE_AMOUNT);
    })

    it('should increase if we deposit between epoch 1 and 2 after epoch 2 has passed', async () => {
      expect(await boardroom.currentEpoch()).to.eq(1)
      expect(await boardroom.getBalanceFromLastEpoch(whale.address)).to.eq(0);

      await vault.connect(whale).bond(STAKE_AMOUNT);
      expect(await boardroom.getBalanceFromLastEpoch(whale.address)).to.eq(0);

      await expect(boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT))
        .to.emit(boardroom, 'RewardAdded')
        .withArgs(operator.address, SEIGNIORAGE_AMOUNT);
      expect(await boardroom.currentEpoch()).to.eq(2)

      expect(await boardroom.getBalanceFromLastEpoch(whale.address)).to.eq(STAKE_AMOUNT);
      await vault.connect(whale).bond(STAKE_AMOUNT);
      expect(await boardroom.getBalanceFromLastEpoch(whale.address)).to.eq(STAKE_AMOUNT);

      await expect(boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT))
        .to.emit(boardroom, 'RewardAdded')
        .withArgs(operator.address, SEIGNIORAGE_AMOUNT);
      expect(await boardroom.currentEpoch()).to.eq(3)

      expect(await boardroom.getBalanceFromLastEpoch(whale.address)).to.eq(STAKE_AMOUNT.mul(2));
      await vault.connect(whale).bond(STAKE_AMOUNT);
      expect(await boardroom.getBalanceFromLastEpoch(whale.address)).to.eq(STAKE_AMOUNT.mul(2));

      await expect(boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT))
        .to.emit(boardroom, 'RewardAdded')
        .withArgs(operator.address, SEIGNIORAGE_AMOUNT);
      expect(await boardroom.currentEpoch()).to.eq(4)
      expect(await boardroom.getBalanceFromLastEpoch(whale.address)).to.eq(STAKE_AMOUNT.mul(3));
    })

    it('should decrease if we withdraw between epoch 1 and 2 after epoch 2 has passed', async () => {
      expect(await boardroom.currentEpoch()).to.eq(1)
      expect(await boardroom.getBalanceFromLastEpoch(whale.address)).to.eq(0);

      await vault.connect(whale).bond(STAKE_AMOUNT);
      expect(await boardroom.getBalanceFromLastEpoch(whale.address)).to.eq(0);

      await expect(boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT))
        .to.emit(boardroom, 'RewardAdded')
        .withArgs(operator.address, SEIGNIORAGE_AMOUNT);
      expect(await boardroom.currentEpoch()).to.eq(2)

      expect(await boardroom.getBalanceFromLastEpoch(whale.address)).to.eq(STAKE_AMOUNT);
      await vault.connect(whale).unbond(STAKE_AMOUNT);
      expect(await boardroom.getBalanceFromLastEpoch(whale.address)).to.eq(STAKE_AMOUNT);

      await expect(boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT))
        .to.emit(boardroom, 'RewardAdded')
        .withArgs(operator.address, SEIGNIORAGE_AMOUNT);
      expect(await boardroom.currentEpoch()).to.eq(3)

      expect(await boardroom.getBalanceFromLastEpoch(whale.address)).to.eq(0);
      await vault.connect(whale).bond(STAKE_AMOUNT);
      expect(await boardroom.getBalanceFromLastEpoch(whale.address)).to.eq(0);
    })

    it.only('should decrease if we withdraw between epoch 1 and 2 after epoch 2 has passed', async () => {
      expect(await boardroom.currentEpoch()).to.eq(1)

      expect(await boardroom.getBalanceFromLastEpoch(whale.address)).to.eq(0);
      await vault.connect(whale).bond(STAKE_AMOUNT);
      expect(await boardroom.getBalanceFromLastEpoch(whale.address)).to.eq(0);

      await expect(boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT))
        .to.emit(boardroom, 'RewardAdded')
        .withArgs(operator.address, SEIGNIORAGE_AMOUNT);
      expect(await boardroom.currentEpoch()).to.eq(2)

      expect(await boardroom.getBalanceFromLastEpoch(whale.address)).to.eq(STAKE_AMOUNT);
      expect(await vault.balanceWithoutBonded(whale.address)).to.eq(STAKE_AMOUNT);
      await vault.connect(whale).unbond(STAKE_AMOUNT);
      expect(await vault.balanceWithoutBonded(whale.address)).to.eq(0);
      expect(await boardroom.getBalanceFromLastEpoch(whale.address)).to.eq(STAKE_AMOUNT);

      await expect(boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT))
        .to.emit(boardroom, 'RewardAdded')
        .withArgs(operator.address, SEIGNIORAGE_AMOUNT);
      expect(await boardroom.currentEpoch()).to.eq(3)

      expect(await boardroom.getBalanceFromLastEpoch(whale.address)).to.eq(0);
      await vault.connect(whale).bond(STAKE_AMOUNT);
      expect(await boardroom.getBalanceFromLastEpoch(whale.address)).to.eq(0);
    })
  })

  describe('#Bond', () => {
    it('Should work correctly', async () => {
      await Promise.all([
        share.connect(operator).mint(whale.address, STAKE_AMOUNT),
        share.connect(whale).approve(vault.address, STAKE_AMOUNT),
      ]);

      await expect(vault.connect(whale).bond(STAKE_AMOUNT))
        .to.emit(vault, 'Bonded')
        .withArgs(whale.address, STAKE_AMOUNT);

      expect(await vault.balanceOf(whale.address)).to.eq(STAKE_AMOUNT);
    });

    it('Should fail when user tries to bond with zero amount', async () => {
      await expect(vault.connect(whale).bond(ZERO)).to.revertedWith(
        'Boardroom: cannot bond 0'
      );
    });

    it('Should fail when deposits are disabled', async () => {
      await vault.connect(operator).toggleDeposits(false);

      await expect(vault.connect(whale).bond(STAKE_AMOUNT)).to.revertedWith(
        'Boardroom: deposits are disabled'
      );
    });
  });

  describe('#Unbond', async () => {
    beforeEach('Should be able to stake', async () => {
      await Promise.all([
        share.connect(operator).mint(whale.address, STAKE_AMOUNT),
        share.connect(whale).approve(vault.address, STAKE_AMOUNT),
      ]);

      await vault.connect(whale).bond(STAKE_AMOUNT);
    });

    it('Should work', async () => {
      await expect(vault.connect(whale).unbond(STAKE_AMOUNT))
        .to.emit(vault, 'Unbonded')
        .withArgs(whale.address, STAKE_AMOUNT);

      expect(await share.balanceOf(whale.address)).to.eq(ZERO);
      expect(await vault.balanceOf(whale.address)).to.eq(STAKE_AMOUNT);
    });

    it('Should fail when user tries to ubond with zero amount', async () => {
      await advanceTimeAndBlock(
        provider,
        (await latestBlocktime(provider)) + BOARDROOM_LOCK_PERIOD
      );

      await expect(vault.connect(whale).unbond(ZERO)).to.revertedWith(
        'Boardroom: cannot unbond 0'
      );
    });

    it('Should fail when user tries to unbond more than staked amount', async () => {
      await advanceTimeAndBlock(
        provider,
        (await latestBlocktime(provider)) + BOARDROOM_LOCK_PERIOD
      );

      await expect(
        vault.connect(whale).unbond(STAKE_AMOUNT.add(1))
      ).to.revertedWith(
        'Boardroom: unbond request greater than staked amount'
      );
    });

    it('Should fail when non-director tries to withdraw', async () => {
      await advanceTimeAndBlock(
        provider,
        BOARDROOM_LOCK_PERIOD
      );

      await expect(vault.connect(abuser).unbond(ZERO)).to.revertedWith(
        'Boardroom: The director does not exist'
      );
    });
  });

  describe('#Withdraw', async () => {
    beforeEach('Should be able to stake', async () => {
      await Promise.all([
        share.connect(operator).mint(whale.address, STAKE_AMOUNT),
        share.connect(whale).approve(vault.address, STAKE_AMOUNT),
      ]);

      await vault.connect(whale).bond(STAKE_AMOUNT);
    });

    it('Should not be able to withdraw without unbonding and time < boardroomLockPeriod', async () => {
      await expect(vault.connect(whale).withdraw()).revertedWith('')

      expect(await share.balanceOf(whale.address)).to.eq(ZERO);
      expect(await vault.balanceOf(whale.address)).to.eq(STAKE_AMOUNT);
    });

    it('Should not be able to withdraw without unbonding and time > boardroomLockPeriod', async () => {
      await advanceTimeAndBlock(
        provider,
        (await latestBlocktime(provider)) + BOARDROOM_LOCK_PERIOD
      );

      await expect(vault.connect(whale).withdraw()).revertedWith('')

      expect(await share.balanceOf(whale.address)).to.eq(ZERO);
      expect(await vault.balanceOf(whale.address)).to.eq(STAKE_AMOUNT);
    });

    it('Should not be able to withdraw with unbonding and time < boardroomLockPeriod', async () => {
      await vault.connect(whale).unbond(STAKE_AMOUNT);

      await expect(vault.connect(whale).withdraw()).revertedWith('')

      expect(await share.balanceOf(whale.address)).to.eq(ZERO);
      expect(await vault.balanceOf(whale.address)).to.eq(STAKE_AMOUNT);
    });

    it('Should be able to withdraw with unbonding and time > boardroomLockPeriod', async () => {
      await vault.connect(whale).unbond(STAKE_AMOUNT);

      await advanceTimeAndBlock(
        provider,
        (await latestBlocktime(provider)) + BOARDROOM_LOCK_PERIOD
      );

      await expect(vault.connect(whale).withdraw())
        .to.emit(vault, 'Withdrawn')
        .withArgs(whale.address, STAKE_AMOUNT);

      expect(await share.balanceOf(whale.address)).to.eq(STAKE_AMOUNT);
      expect(await vault.balanceOf(whale.address)).to.eq(ZERO);
    });

    it('Should fail when non-director tries to withdraw', async () => {
      await advanceTimeAndBlock(
        provider,
        (await latestBlocktime(provider)) + BOARDROOM_LOCK_PERIOD
      );

      await expect(vault.connect(abuser).withdraw()).to.revertedWith(
        'Boardroom: The director does not exist'
      );
    });

    it('Should not be able to withdraw twice if only unbonded once', async () => {
      await vault.connect(whale).unbond(STAKE_AMOUNT);

      await advanceTimeAndBlock(
        provider,
        (await latestBlocktime(provider)) + BOARDROOM_LOCK_PERIOD
      );

      await expect(vault.connect(whale).withdraw())
        .to.emit(vault, 'Withdrawn')
        .withArgs(whale.address, STAKE_AMOUNT);

      expect(await share.balanceOf(whale.address)).to.eq(STAKE_AMOUNT);
      expect(await vault.balanceOf(whale.address)).to.eq(ZERO);

      await advanceTimeAndBlock(
        provider,
        (await latestBlocktime(provider)) + BOARDROOM_LOCK_PERIOD
      );

      await expect(vault.connect(whale).withdraw()).to.revertedWith(
        'Boardroom: The director does not exist'
      );
    });
  });

  describe('#AllocateSeigniorage', () => {
    beforeEach('Should be able to stake', async () => {
      await Promise.all([
        share.connect(operator).mint(whale.address, STAKE_AMOUNT),
        share.connect(whale).approve(vault.address, STAKE_AMOUNT),
      ]);

      await vault.connect(whale).bond(STAKE_AMOUNT);
    });

    it('Should allocate seigniorage to stakers', async () => {
      await cash.connect(operator).mint(operator.address, SEIGNIORAGE_AMOUNT);
      await cash
        .connect(operator)
        .approve(boardroom.address, SEIGNIORAGE_AMOUNT);

      await expect(
        boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT)
      )
        .to.emit(boardroom, 'RewardAdded')
        .withArgs(operator.address, SEIGNIORAGE_AMOUNT);

      // expect(await boardroom.earned(whale.address)).to.eq(
      //   SEIGNIORAGE_AMOUNT
      // );
    });

    it('Should fail when user tries to allocate with zero amount', async () => {
      await expect(
        boardroom.connect(operator).allocateSeigniorage(ZERO)
      ).to.revertedWith('Boardroom: Cannot allocate 0');
    });

    it('Should fail when non-operator tries to allocate seigniorage', async () => {
      await expect(
        boardroom.connect(abuser).allocateSeigniorage(ZERO)
      ).to.revertedWith('operator: caller is not the operator');
    });
  });

  describe('#ClaimDividends', () => {
    beforeEach('Should be able to stake', async () => {
      await Promise.all([
        share.connect(operator).mint(whale.address, STAKE_AMOUNT),
        share.connect(whale).approve(vault.address, STAKE_AMOUNT),

        share.connect(operator).mint(abuser.address, STAKE_AMOUNT),
        share.connect(abuser).approve(vault.address, STAKE_AMOUNT),
      ]);

      await vault.connect(whale).bond(STAKE_AMOUNT);
    });

    it('Should claim vesting devidends correctly', async () => {
      await cash.connect(operator).mint(operator.address, SEIGNIORAGE_AMOUNT);
      await cash
        .connect(operator)
        .approve(boardroom.address, SEIGNIORAGE_AMOUNT);
      await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT);

      await expect(boardroom.connect(whale).claimReward())
        .to.emit(boardroom, 'RewardPaid');

      expect(await share.balanceOf(whale.address)).to.eq(ZERO);
      expect(await cash.balanceOf(whale.address)).to.eq(SEIGNIORAGE_AMOUNT);
      expect(await vault.balanceOf(whale.address)).to.eq(STAKE_AMOUNT);
    });

    it('Should claim devidends correctly even after other person stakes after snapshot', async () => {
      await cash.connect(operator).mint(operator.address, SEIGNIORAGE_AMOUNT);
      await cash
        .connect(operator)
        .approve(boardroom.address, SEIGNIORAGE_AMOUNT);
      await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT);

      await vault.connect(abuser).bond(STAKE_AMOUNT);

      await expect(boardroom.connect(whale).claimReward())
        .to.emit(boardroom, 'RewardPaid');

      expect(await share.balanceOf(whale.address)).to.eq(ZERO);
      expect(await cash.balanceOf(abuser.address)).to.eq(ZERO);
      expect(await share.balanceOf(abuser.address)).to.eq(ZERO);
      expect(await cash.balanceOf(whale.address)).to.eq(SEIGNIORAGE_AMOUNT);
      expect(await vault.balanceOf(whale.address)).to.eq(STAKE_AMOUNT);
      expect(await vault.balanceOf(abuser.address)).to.eq(STAKE_AMOUNT);
    });
  });
});

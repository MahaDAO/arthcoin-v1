import chai, { expect } from 'chai';
import { ethers } from 'hardhat';
import { solidity } from 'ethereum-waffle';
import { Contract, ContractFactory, BigNumber, utils } from 'ethers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';

import { advanceTimeAndBlock, latestBlocktime } from '../shared/utilities';
// import { TREASURY_START_DATE } from '../../deploy.config';


chai.use(solidity);


describe('BondedBoardroom', () => {
  // const DAY = 86400;

  const BOARDROOM_LOCK_PERIOD = 5 * 60;
  const ETH = utils.parseEther('1');
  const ZERO = BigNumber.from(0);
  const STAKE_AMOUNT = ETH.mul(5000);
  const SEIGNIORAGE_AMOUNT = ETH.mul(10000);

  const { provider } = ethers;

  let operator: SignerWithAddress;
  let whale: SignerWithAddress;
  let abuser: SignerWithAddress;

  before('Provider & accounts setting', async () => {
    [operator, whale, abuser] = await ethers.getSigners();
  });

  let ARTH: ContractFactory;
  let BondedBoardroom: ContractFactory;
  let SHARE: ContractFactory;

  before('Fetch contract factories', async () => {
    ARTH = await ethers.getContractFactory('ARTH');
    SHARE = await ethers.getContractFactory('MahaToken');
    BondedBoardroom = await ethers.getContractFactory('BondedBoardroom');
  });

  let cash: Contract;
  let share: Contract;
  let boardroom: Contract;

  beforeEach('Deploy contracts', async () => {
    cash = await ARTH.connect(operator).deploy();
    share = await SHARE.connect(operator).deploy();
    boardroom = await BondedBoardroom.connect(operator).deploy(
      cash.address,
      share.address,
      BOARDROOM_LOCK_PERIOD
    );
  });

  describe('#Bond', () => {
    it('Should work correctly', async () => {
      await Promise.all([
        share.connect(operator).mint(whale.address, STAKE_AMOUNT),
        share.connect(whale).approve(boardroom.address, STAKE_AMOUNT),
      ]);

      await expect(boardroom.connect(whale).bond(STAKE_AMOUNT))
        .to.emit(boardroom, 'Bonded')
        .withArgs(whale.address, STAKE_AMOUNT);

      const latestSnapshotIndex = await boardroom.latestSnapshotIndex();

      expect(await boardroom.balanceOf(whale.address)).to.eq(STAKE_AMOUNT);

      expect(await boardroom.getLastSnapshotIndexOf(whale.address)).to.eq(
        latestSnapshotIndex
      );
    });

    it('Should fail when user tries to bond with zero amount', async () => {
      await expect(boardroom.connect(whale).bond(ZERO)).to.revertedWith(
        'Boardroom: Cannot stake 0'
      );
    });
  });

  describe('#Unbond', async () => {
    beforeEach('Should be able to stake', async () => {
      await Promise.all([
        share.connect(operator).mint(whale.address, STAKE_AMOUNT),
        share.connect(whale).approve(boardroom.address, STAKE_AMOUNT),
      ]);

      await boardroom.connect(whale).bond(STAKE_AMOUNT);
    });

    it('Should work', async () => {
      await expect(boardroom.connect(whale).unbond(STAKE_AMOUNT))
        .to.emit(boardroom, 'Unbonded')
        .withArgs(whale.address, STAKE_AMOUNT);

      expect(await share.balanceOf(whale.address)).to.eq(ZERO);
      expect(await boardroom.balanceOf(whale.address)).to.eq(STAKE_AMOUNT);
    });

    it('Should fail when user tries to ubond with zero amount', async () => {
      await advanceTimeAndBlock(
        provider,
        (await latestBlocktime(provider)) + BOARDROOM_LOCK_PERIOD
      );

      await expect(boardroom.connect(whale).unbond(ZERO)).to.revertedWith(
        'Boardroom: Cannot unbond 0'
      );
    });

    it('Should fail when user tries to unbond more than staked amount', async () => {
      await advanceTimeAndBlock(
        provider,
        (await latestBlocktime(provider)) + BOARDROOM_LOCK_PERIOD
      );

      await expect(
        boardroom.connect(whale).unbond(STAKE_AMOUNT.add(1))
      ).to.revertedWith(
        'Boardroom: unbond request greater than staked amount'
      );
    });

    it('Should fail when non-director tries to withdraw', async () => {
      await advanceTimeAndBlock(
        provider,
        (await latestBlocktime(provider)) + BOARDROOM_LOCK_PERIOD
      );

      await expect(boardroom.connect(abuser).unbond(ZERO)).to.revertedWith(
        'Boardroom: The director does not exist'
      );
    });
  });

  describe('#Withdraw', async () => {
    beforeEach('Should be able to stake', async () => {
      await Promise.all([
        share.connect(operator).mint(whale.address, STAKE_AMOUNT),
        share.connect(whale).approve(boardroom.address, STAKE_AMOUNT),
      ]);

      await boardroom.connect(whale).bond(STAKE_AMOUNT);
    });

    it('Should not be able to withdraw without unbonding and time < boardroomLockPeriod', async () => {
      await expect(boardroom.connect(whale).withdraw()).revertedWith('')

      expect(await share.balanceOf(whale.address)).to.eq(ZERO);
      expect(await boardroom.balanceOf(whale.address)).to.eq(STAKE_AMOUNT);
    });

    it('Should not be able to withdraw without unbonding and time > boardroomLockPeriod', async () => {
      await advanceTimeAndBlock(
        provider,
        (await latestBlocktime(provider)) + BOARDROOM_LOCK_PERIOD
      );

      await expect(boardroom.connect(whale).withdraw()).revertedWith('')

      expect(await share.balanceOf(whale.address)).to.eq(ZERO);
      expect(await boardroom.balanceOf(whale.address)).to.eq(STAKE_AMOUNT);
    });

    it('Should not be able to withdraw with unbonding and time < boardroomLockPeriod', async () => {
      await boardroom.connect(whale).unbond(STAKE_AMOUNT);

      await expect(boardroom.connect(whale).withdraw()).revertedWith('')

      expect(await share.balanceOf(whale.address)).to.eq(ZERO);
      expect(await boardroom.balanceOf(whale.address)).to.eq(STAKE_AMOUNT);
    });

    it('Should be able to withdraw with unbonding and time > boardroomLockPeriod', async () => {
      await boardroom.connect(whale).unbond(STAKE_AMOUNT);

      await advanceTimeAndBlock(
        provider,
        (await latestBlocktime(provider)) + BOARDROOM_LOCK_PERIOD
      );

      await expect(boardroom.connect(whale).withdraw())
        .to.emit(boardroom, 'Withdrawn')
        .withArgs(whale.address, STAKE_AMOUNT);

      expect(await share.balanceOf(whale.address)).to.eq(STAKE_AMOUNT);
      expect(await boardroom.balanceOf(whale.address)).to.eq(ZERO);
    });

    it('Should fail when non-director tries to withdraw', async () => {
      await advanceTimeAndBlock(
        provider,
        (await latestBlocktime(provider)) + BOARDROOM_LOCK_PERIOD
      );

      await expect(boardroom.connect(abuser).withdraw()).to.revertedWith(
        'Boardroom: The director does not exist'
      );
    });
  });

  describe('#Exit', async () => {
    beforeEach('Should be able to stake', async () => {
      await Promise.all([
        share.connect(operator).mint(whale.address, STAKE_AMOUNT),
        share.connect(whale).approve(boardroom.address, STAKE_AMOUNT),
      ]);

      await boardroom.connect(whale).bond(STAKE_AMOUNT);
    });

    it('Should not be able to exit without unbonding and time < boardroomLockPeriod', async () => {
      await expect(boardroom.connect(whale).exit()).revertedWith('')

      expect(await share.balanceOf(whale.address)).to.eq(ZERO);
      expect(await boardroom.balanceOf(whale.address)).to.eq(STAKE_AMOUNT);
    });

    it('Should not be able to exit without unbonding and time > boardroomLockPeriod', async () => {
      await advanceTimeAndBlock(
        provider,
        (await latestBlocktime(provider)) + BOARDROOM_LOCK_PERIOD
      );

      await expect(boardroom.connect(whale).exit()).to.revertedWith('')

      expect(await share.balanceOf(whale.address)).to.eq(ZERO);
      expect(await boardroom.balanceOf(whale.address)).to.eq(STAKE_AMOUNT);
    });

    it('Should not be able to exit with unbonding and time < boardroomLockPeriod', async () => {
      await boardroom.connect(whale).unbond(STAKE_AMOUNT);

      await expect(boardroom.connect(whale).exit()).revertedWith('')

      expect(await share.balanceOf(whale.address)).to.eq(ZERO);
      expect(await boardroom.balanceOf(whale.address)).to.eq(STAKE_AMOUNT);
    });

    it('Should be able to exit with unbonding and time > boardroomLockPeriod', async () => {
      await boardroom.connect(whale).unbond(STAKE_AMOUNT);

      await advanceTimeAndBlock(
        provider,
        (await latestBlocktime(provider)) + 2 * BOARDROOM_LOCK_PERIOD
      );

      await expect(boardroom.connect(whale).withdraw())
        .to.emit(boardroom, 'Withdrawn')
        .withArgs(whale.address, STAKE_AMOUNT);

      expect(await share.balanceOf(whale.address)).to.eq(STAKE_AMOUNT);
      expect(await boardroom.balanceOf(whale.address)).to.eq(ZERO);
      expect(await cash.balanceOf(whale.address)).to.gte(ZERO); // Since no seigniorage is allocated.
    });

    it('Should fail when non-director tries to exit', async () => {
      await advanceTimeAndBlock(
        provider,
        (await latestBlocktime(provider)) + BOARDROOM_LOCK_PERIOD
      );

      await expect(boardroom.connect(abuser).exit()).to.revertedWith(
        'Boardroom: The director does not exist'
      );
    });
  });

  describe('#AllocateSeigniorage', () => {
    beforeEach('Should be able to stake', async () => {
      await Promise.all([
        share.connect(operator).mint(whale.address, STAKE_AMOUNT),
        share.connect(whale).approve(boardroom.address, STAKE_AMOUNT),
      ]);

      await boardroom.connect(whale).bond(STAKE_AMOUNT);
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

      expect(await boardroom.earned(whale.address)).to.eq(
        SEIGNIORAGE_AMOUNT
      );
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
        share.connect(whale).approve(boardroom.address, STAKE_AMOUNT),

        share.connect(operator).mint(abuser.address, STAKE_AMOUNT),
        share.connect(abuser).approve(boardroom.address, STAKE_AMOUNT),
      ]);

      await boardroom.connect(whale).bond(STAKE_AMOUNT);
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
      expect(await boardroom.balanceOf(whale.address)).to.eq(STAKE_AMOUNT);
    });

    it('Should claim devidends correctly even after other person stakes after snapshot', async () => {
      await cash.connect(operator).mint(operator.address, SEIGNIORAGE_AMOUNT);
      await cash
        .connect(operator)
        .approve(boardroom.address, SEIGNIORAGE_AMOUNT);
      await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT);

      await boardroom.connect(abuser).bond(STAKE_AMOUNT);

      await expect(boardroom.connect(whale).claimReward())
        .to.emit(boardroom, 'RewardPaid');

      expect(await share.balanceOf(whale.address)).to.eq(ZERO);
      expect(await cash.balanceOf(abuser.address)).to.eq(ZERO);
      expect(await share.balanceOf(abuser.address)).to.eq(ZERO);
      expect(await cash.balanceOf(whale.address)).to.eq(SEIGNIORAGE_AMOUNT);
      expect(await boardroom.balanceOf(whale.address)).to.eq(STAKE_AMOUNT);
      expect(await boardroom.balanceOf(abuser.address)).to.eq(STAKE_AMOUNT);
    });
  });
});

import chai, { expect } from 'chai';
import { ethers } from 'hardhat';
import { solidity } from 'ethereum-waffle';
import { Contract, ContractFactory, BigNumber, utils } from 'ethers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';

import { advanceTimeAndBlock, latestBlocktime } from '../shared/utilities';
import { TREASURY_START_DATE } from '../../deploy.config';
// import { TREASURY_START_DATE } from '../../deploy.config';


chai.use(solidity);


describe('Vault', () => {
  // const DAY = 86400;

  const REWARDS_VESTING = 8 * 3600
  const BOARDROOM_LOCK_PERIOD = 5 * 60;
  const ETH = utils.parseEther('1');
  const ZERO = BigNumber.from(0);
  const STAKE_AMOUNT = ETH.mul(5000);
  const SEIGNIORAGE_AMOUNT = ETH.mul(10000);

  const { provider } = ethers;

  let operator: SignerWithAddress;
  let whale: SignerWithAddress;
  let abuser: SignerWithAddress;
  let testBoardroom1: SignerWithAddress;
  let testBoardroom2: SignerWithAddress;

  before('Provider & accounts setting', async () => {
    [operator, whale, abuser, testBoardroom1, testBoardroom2] = await ethers.getSigners();
  });

  let ARTH: ContractFactory;
  let Vault: ContractFactory;
  let SHARE: ContractFactory;

  before('Fetch contract factories', async () => {
    ARTH = await ethers.getContractFactory('ARTH');
    SHARE = await ethers.getContractFactory('MahaToken');
    Vault = await ethers.getContractFactory('Vault');
  });

  let cash: Contract;
  let share: Contract;
  let vault: Contract;

  beforeEach('Deploy contracts', async () => {
    cash = await ARTH.connect(operator).deploy();
    share = await SHARE.connect(operator).deploy();
    vault = await Vault.connect(operator).deploy(
      share.address,
      BOARDROOM_LOCK_PERIOD
    );
  });

  describe('#setBoardrooms', () => {
    it('Should not work if not owner', async () => {
      await expect(vault.connect(whale).setBoardrooms(testBoardroom1.address, testBoardroom2.address)).to.revertedWith(
        'Ownable: caller is not the owner'
      );
    });

    it('Should work if owner', async () => {
      await expect(vault.connect(operator).setBoardrooms(testBoardroom1.address, testBoardroom2.address)).to.not.reverted;
    });
  });

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
});

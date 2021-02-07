import chai, { expect } from 'chai';
import { ethers } from 'hardhat';
import { solidity } from 'ethereum-waffle';
import { Contract, ContractFactory, BigNumber, utils } from 'ethers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';

import { advanceTimeAndBlock, latestBlocktime } from '../shared/utilities';


chai.use(solidity);


describe('Simple Boardroom', () => {
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
  let SimpleBoardroom: ContractFactory;

  before('Fetch contract factories', async () => {
    ARTH = await ethers.getContractFactory('ARTH');
    SimpleBoardroom = await ethers.getContractFactory('SimpleBoardroom');
  });

  let cash: Contract;
  let boardroom: Contract;

  beforeEach('Deploy contracts', async () => {
    cash = await ARTH.connect(operator).deploy();
    boardroom = await SimpleBoardroom.connect(operator).deploy(
      cash.address,
      cash.address,
      BOARDROOM_LOCK_PERIOD
    );
  });

  describe('#Stake', () => {
    it('Should work correctly', async () => {
      await Promise.all([
        cash.connect(operator).mint(whale.address, STAKE_AMOUNT),
        cash.connect(whale).approve(boardroom.address, STAKE_AMOUNT),
      ]);

      await expect(boardroom.connect(whale).stake(STAKE_AMOUNT))
        .to.emit(boardroom, 'Staked')
        .withArgs(whale.address, STAKE_AMOUNT);

      const latestSnapshotIndex = await boardroom.latestSnapshotIndex();

      expect(await boardroom.balanceOf(whale.address)).to.eq(STAKE_AMOUNT);

      expect(await boardroom.getLastSnapshotIndexOf(whale.address)).to.eq(
        latestSnapshotIndex
      );
    });

    it('Should fail when user tries to stake with zero amount', async () => {
      await expect(boardroom.connect(whale).stake(ZERO)).to.revertedWith(
        'Boardroom: Cannot stake 0'
      );
    });
  });

  describe('#Withdraw', async () => {
    beforeEach('Should be able to stake', async () => {
      await Promise.all([
        cash.connect(operator).mint(whale.address, STAKE_AMOUNT),
        cash.connect(whale).approve(boardroom.address, STAKE_AMOUNT),
      ]);

      await boardroom.connect(whale).stake(STAKE_AMOUNT);
    });

    it('Should not be able to withdraw before withdrawal duration is satisifed', async () => {
      await expect(boardroom.connect(whale).withdraw(STAKE_AMOUNT)).revertedWith('')

      expect(await cash.balanceOf(whale.address)).to.eq(ZERO);
      expect(await boardroom.balanceOf(whale.address)).to.eq(STAKE_AMOUNT);
    });

    it('Should work correctly now', async () => {
      await advanceTimeAndBlock(
        provider,
        (await latestBlocktime(provider)) + BOARDROOM_LOCK_PERIOD
      );

      await expect(boardroom.connect(whale).withdraw(STAKE_AMOUNT))
        .to.emit(boardroom, 'Withdrawn')
        .withArgs(whale.address, STAKE_AMOUNT);

      expect(await cash.balanceOf(whale.address)).to.eq(STAKE_AMOUNT);
      expect(await boardroom.balanceOf(whale.address)).to.eq(ZERO);
    });

    it('Should fail when user tries to withdraw with zero amount', async () => {
      await advanceTimeAndBlock(
        provider,
        (await latestBlocktime(provider)) + BOARDROOM_LOCK_PERIOD
      );

      await expect(boardroom.connect(whale).withdraw(ZERO)).to.revertedWith(
        'Boardroom: Cannot withdraw 0'
      );
    });

    it('Should fail when user tries to withdraw more than staked amount', async () => {
      await advanceTimeAndBlock(
        provider,
        (await latestBlocktime(provider)) + BOARDROOM_LOCK_PERIOD
      );

      await expect(
        boardroom.connect(whale).withdraw(STAKE_AMOUNT.add(1))
      ).to.revertedWith(
        'Boardroom: withdraw request greater than staked amount'
      );
    });

    it('Should fail when non-director tries to withdraw', async () => {
      await advanceTimeAndBlock(
        provider,
        (await latestBlocktime(provider)) + BOARDROOM_LOCK_PERIOD
      );

      await expect(boardroom.connect(abuser).withdraw(ZERO)).to.revertedWith(
        'Boardroom: The director does not exist'
      );
    });
  });

  describe('#Exit', async () => {
    beforeEach('Should be able to stake', async () => {
      await Promise.all([
        cash.connect(operator).mint(whale.address, STAKE_AMOUNT),
        cash.connect(whale).approve(boardroom.address, STAKE_AMOUNT),
      ]);

      await boardroom.connect(whale).stake(STAKE_AMOUNT);
    });

    it('Should not be able to withdraw before withdrawal duration is satisifed', async () => {
      try {
        await expect(boardroom.connect(whale).exit())
          .to.emit(boardroom, 'Withdrawn')
          .withArgs(whale.address, STAKE_AMOUNT);

        expect(await cash.balanceOf(whale.address)).to.eq(STAKE_AMOUNT);
        expect(await boardroom.balanceOf(whale.address)).to.eq(ZERO);
        expect(false);
      } catch (e) {
        expect(true);
      }
    });

    await new Promise(resolve => setTimeout(resolve, 1000 * BOARDROOM_LOCK_PERIOD));

    it('Should work correctly now', async () => {
      await expect(boardroom.connect(whale).exit())
        .to.emit(boardroom, 'Withdrawn')
        .withArgs(whale.address, STAKE_AMOUNT);

      expect(await cash.balanceOf(whale.address)).to.eq(STAKE_AMOUNT);
      expect(await boardroom.balanceOf(whale.address)).to.eq(ZERO);
    });
  });

  describe('#AllocateSeigniorage', () => {
    beforeEach('Should be able to stake', async () => {
      await Promise.all([
        cash.connect(operator).mint(whale.address, STAKE_AMOUNT),
        cash.connect(whale).approve(boardroom.address, STAKE_AMOUNT),
      ]);
      await boardroom.connect(whale).stake(STAKE_AMOUNT);
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
        cash.connect(operator).mint(whale.address, STAKE_AMOUNT),
        cash.connect(whale).approve(boardroom.address, STAKE_AMOUNT),

        cash.connect(operator).mint(abuser.address, STAKE_AMOUNT),
        cash.connect(abuser).approve(boardroom.address, STAKE_AMOUNT),
      ]);

      await boardroom.connect(whale).stake(STAKE_AMOUNT);
    });

    it('Should claim devidends', async () => {
      await cash.connect(operator).mint(operator.address, SEIGNIORAGE_AMOUNT);
      await cash
        .connect(operator)
        .approve(boardroom.address, SEIGNIORAGE_AMOUNT);
      await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT);

      await expect(boardroom.connect(whale).claimReward())
        .to.emit(boardroom, 'RewardPaid')
        .withArgs(whale.address, SEIGNIORAGE_AMOUNT);
      expect(await boardroom.balanceOf(whale.address)).to.eq(STAKE_AMOUNT);
    });

    it('Should claim devidends correctly even after other person stakes after snapshot', async () => {
      await cash.connect(operator).mint(operator.address, SEIGNIORAGE_AMOUNT);
      await cash
        .connect(operator)
        .approve(boardroom.address, SEIGNIORAGE_AMOUNT);
      await boardroom.connect(operator).allocateSeigniorage(SEIGNIORAGE_AMOUNT);

      await boardroom.connect(abuser).stake(STAKE_AMOUNT);

      await expect(boardroom.connect(whale).claimReward())
        .to.emit(boardroom, 'RewardPaid')
        .withArgs(whale.address, SEIGNIORAGE_AMOUNT);
      expect(await boardroom.balanceOf(whale.address)).to.eq(STAKE_AMOUNT);
    });
  });
});

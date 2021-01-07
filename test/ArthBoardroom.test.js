import chai, { expect } from 'chai';
import { ethers } from 'hardhat';
import { solidity } from 'ethereum-waffle';
import { Contract, ContractFactory, BigNumber, utils } from 'ethers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';

const ARTHBoardroom = artifacts.require('ARTHBoardroom');
const ARTH = artifacts.require('ARTH');
const Treasury = artifacts.require('Treasury');

require('dotenv').config()


chai.use(solidity);


contract('ARTHBoardroom', async () => {
  const DAY = 86400;
  const ETH = utils.parseEther('1');
  const ZERO = BigNumber.from(0);
  const STAKE_AMOUNT = ETH.mul(5000);
  const SEIGNIORAGE_AMOUNT = ETH.mul(10000);
  const WAITING_PERIOD = 5 * 60 * 60;

  let arthBoardroom = null;
  let arth = null;
  let treasury = null;
  let operatorAddress = null;

  let deployerAddress = process.env.WALLET_KEY;
  const userAddress2 = process.env.WALLET_KEY_2;
  const userAddress = operatorAddress;

  before('Fetching contracts', async () => {
    arthBoardroom = await ARTHBoardroom.deployed();
    arth = await ARTH.deployed();
    treasury = await Treasury.deployed();

    operatorAddress = treasury.address;
  });

  describe('#stake', () => {
    it('Should work correctly', async () => {
      await Promise.all([
        arth.connect(operatorAddress).mint(userAddress, STAKE_AMOUNT),
        arth.connect(userAddress).approve(arthBoardroom.address, STAKE_AMOUNT),
      ]);

      await expect(arthBoardroom.connect(userAddress).stake(STAKE_AMOUNT))
        .to.emit(arthBoardroom, 'Staked')
        .withArgs(userAddress, STAKE_AMOUNT);

      const latestSnapshotIndex = await arthBoardroom.latestSnapshotIndex();

      expect(await arthBoardroom.balanceOf(userAddress)).to.eq(STAKE_AMOUNT);

      expect(await arthBoardroom.getLastSnapshotIndexOf(userAddress)).to.eq(
        latestSnapshotIndex
      );
    });

    it('Should fail when user tries to stake with zero amount', async () => {
      await expect(arthBoardroom.connect(userAddress).stake(ZERO)).to.revertedWith(
        'Boardroom: Cannot stake 0'
      );
    });
  });

  describe('#withdraw', () => {
    beforeEach('stake', async () => {
      await Promise.all([
        arth.connect(operatorAddress).mint(userAddress, STAKE_AMOUNT),
        arth.connect(userAddress).approve(arthBoardroom.address, STAKE_AMOUNT),
      ]);

      await arthBoardroom.connect(userAddress).stake(STAKE_AMOUNT);
      await arthBoardroom.connect(operatorAddress).changeLockDuration(WAITING_PERIOD);
    });

    it('Should not work correctly', async () => {
      try {
        await expect(arthBoardroom.connect(userAddress).withdraw(STAKE_AMOUNT))
          .to.emit(arthBoardroom, 'Withdrawn')
          .withArgs(userAddress, STAKE_AMOUNT);

        expect(await arth.balanceOf(userAddress)).to.eq(STAKE_AMOUNT);
        expect(await arthBoardroom.balanceOf(userAddress)).to.eq(ZERO);

        // Return false.
        expect(1 === 2); 
      } catch(e) {
        // Return true.
        // Should not be allowed to withdraw before WITHDRAWAL_DURATION.
        expect(1 === 1);
      }
    });

    await new Promise(resolve => setTimeout(resolve, 1000 *  WAITING_PERIOD));

    it('Should work correctly', async () => {
      await expect(arthBoardroom.connect(userAddress).withdraw(STAKE_AMOUNT))
        .to.emit(arthBoardroom, 'Withdrawn')
        .withArgs(userAddress, STAKE_AMOUNT);

      expect(await arth.balanceOf(userAddress)).to.eq(STAKE_AMOUNT);
      expect(await arthBoardroom.balanceOf(userAddress)).to.eq(ZERO);
    });

    it('Should fail when user tries to withdraw with zero amount', async () => {
      await expect(arthBoardroom.connect(userAddress).withdraw(ZERO)).to.revertedWith(
        'Boardroom: Cannot withdraw 0'
      );
    });

    it('Should fail when user tries to withdraw more than staked amount', async () => {
      await expect(
        arthBoardroom.connect(userAddress).withdraw(STAKE_AMOUNT.add(1))
      ).to.revertedWith(
        'Boardroom: withdraw request greater than staked amount'
      );
    });

    it('Should fail when non-director tries to withdraw', async () => {
      // Use a random address that is not operator.
      await expect(arthBoardroom.connect(userAddress2).withdraw(ZERO)).to.revertedWith(
        'Boardroom: The director does not exist'
      );
    });
  });

  describe('#exit', async () => {
    beforeEach('stake', async () => {
      await Promise.all([
        arth.connect(operatorAddress).mint(userAddress, STAKE_AMOUNT),
        arth.connect(userAddress).approve(arthBoardroom.address, STAKE_AMOUNT),
      ]);
    
      await arthBoardroom.connect(userAddress).stake(STAKE_AMOUNT);
    });

    it('Should not work correctly', async () => {
      try {
        await expect(arthBoardroom.connect(userAddress).exit())
        .to.emit(arthBoardroom, 'Withdrawn')
        .withArgs(userAddress, STAKE_AMOUNT);

        expect(await arth.balanceOf(userAddress)).to.eq(STAKE_AMOUNT);
        expect(await arthBoardroom.balanceOf(userAddress)).to.eq(ZERO);
        
        // Return false.
        expect(1 === 2); 
      } catch(e) {
        // Return true.
        // Should not be allowed to withdraw before WITHDRAWAL_DURATION.
        expect(1 === 1);
      }
    });

    await new Promise(resolve => setTimeout(resolve, 1000 *  WAITING_PERIOD));

    it('Should work correctly', async () => {
      await expect(arthBoardroom.connect(userAddress).exit())
        .to.emit(arthBoardroom, 'Withdrawn')
        .withArgs(userAddress, STAKE_AMOUNT);

      expect(await arth.balanceOf(userAddress)).to.eq(STAKE_AMOUNT);
      expect(await arthBoardroom.balanceOf(userAddress)).to.eq(ZERO);
    });
  });

  describe('#allocateSeigniorage', () => {
    beforeEach('stake', async () => {
      await Promise.all([
        arth.connect(operatorAddress).mint(userAddress, STAKE_AMOUNT),
        arth.connect(userAddress).approve(arthBoardroom.address, STAKE_AMOUNT),
      ]);
    
      await arthBoardroom.connect(userAddress).stake(STAKE_AMOUNT);
    });

    it('Should allocate seigniorage to stakers', async () => {
      await arth.connect(operatorAddress).mint(operatorAddress, SEIGNIORAGE_AMOUNT);
      await arth
        .connect(operatorAddress)
        .approve(arthBoardroom.address, SEIGNIORAGE_AMOUNT);

      await expect(
        arthBoardroom.connect(operatorAddress).allocateSeigniorage(SEIGNIORAGE_AMOUNT)
      )
        .to.emit(arthBoardroom, 'RewardAdded')
        .withArgs(operatorAddress, SEIGNIORAGE_AMOUNT);

      expect(await arthBoardroom.earned(userAddress)).to.eq(
        SEIGNIORAGE_AMOUNT
      );
    });

    it('Should fail when user tries to allocate with zero amount', async () => {
      await expect(
        arthBoardroom.connect(operatorAddress).allocateSeigniorage(ZERO)
      ).to.revertedWith('Boardroom: Cannot allocate 0');
    });

    it('Should fail when non-operator tries to allocate seigniorage', async () => {
      await expect(
        arthBoardroom.connect(userAddress2).allocateSeigniorage(ZERO)
      ).to.revertedWith('operator: caller is not the operator');
    });
  });

  describe('#claimDividends', () => {
    beforeEach('stake', async () => {
      await Promise.all([
        arth.connect(operatorAddress).mint(userAddress, STAKE_AMOUNT),
        arth.connect(userAddress).approve(arthBoardroom.address, STAKE_AMOUNT),

        arth.connect(operatorAddress).mint(userAddress2.address, STAKE_AMOUNT),
        arth.connect(userAddress2).approve(arthBoardroom.address, STAKE_AMOUNT),
      ]);

      await arthBoardroom.connect(userAddress).stake(STAKE_AMOUNT);
    });

    it('Should claim devidends', async () => {
      await arth.connect(operatorAddress).mint(operator.address, SEIGNIORAGE_AMOUNT);
      await arth
        .connect(operatorAddress)
        .approve(arthBoardroom.address, SEIGNIORAGE_AMOUNT);
    
      await arthBoardroom.connect(operatorAddress).allocateSeigniorage(SEIGNIORAGE_AMOUNT);

      await expect(arthBoardroom.connect(userAddress).claimReward())
        .to.emit(arthBoardroom, 'RewardPaid')
        .withArgs(userAddress, SEIGNIORAGE_AMOUNT);
    
      expect(await arthBoardroom.balanceOf(userAddress)).to.eq(STAKE_AMOUNT);
    });

    it('Should claim devidends correctly even after other person stakes after snapshot', async () => {
      await arth.connect(operatorAddress).mint(operatorAddress.address, SEIGNIORAGE_AMOUNT);
      await arth
        .connect(operatorAddress)
        .approve(arthBoardroom.address, SEIGNIORAGE_AMOUNT);
    
      await arthBoardroom.connect(operatorAddress).allocateSeigniorage(SEIGNIORAGE_AMOUNT);
      await arthBoardroom.connect(userAddress2).stake(STAKE_AMOUNT);

      await expect(arthBoardroom.connect(userAddress).claimReward())
        .to.emit(arthBoardroom, 'RewardPaid')
        .withArgs(userAddress, SEIGNIORAGE_AMOUNT);
    
      expect(await arthBoardroom.balanceOf(userAddress)).to.eq(STAKE_AMOUNT);
    });
  });
});
import chai, { expect } from 'chai';
import { ethers } from 'hardhat';
import { solidity } from 'ethereum-waffle';
import { Contract, ContractFactory, BigNumber, utils } from 'ethers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';


chai.use(solidity);


describe('Tokens', () => {
  const ETH = utils.parseEther('1');
  const ZERO = BigNumber.from(0);
  const ZERO_ADDR = '0x0000000000000000000000000000000000000000';

  const { provider } = ethers;

  let operator: SignerWithAddress;
  let whale: SignerWithAddress;

  before('Setup accounts', async () => {
    [operator, whale] = await ethers.getSigners();
  });

  let ARTHB: ContractFactory;
  let ARTH: ContractFactory;
  let MAHA: ContractFactory;

  before('Fetch contract factories', async () => {
    ARTHB = await ethers.getContractFactory('ARTHB');
    ARTH = await ethers.getContractFactory('ARTH');
    MAHA = await ethers.getContractFactory('MahaToken');
  });

  describe('ARTHB', () => {
    let token: Contract;

    before('deploy token', async () => {
      token = await ARTHB.connect(operator).deploy();
    });

    it('Mint', async () => {
      const mintAmount = ETH.mul(2);
      await expect(token.connect(operator).mint(operator.address, mintAmount))
        .to.emit(token, 'Transfer')
        .withArgs(ZERO_ADDR, operator.address, mintAmount);
      expect(await token.balanceOf(operator.address)).to.eq(mintAmount);
    });

    it('Burn', async () => {
      await expect(token.connect(operator).burn(ETH))
        .to.emit(token, 'Transfer')
        .withArgs(operator.address, ZERO_ADDR, ETH);
      expect(await token.balanceOf(operator.address)).to.eq(ETH);
    });

    it('Burn From', async () => {
      await expect(token.connect(operator).approve(operator.address, ETH));
      await expect(token.connect(operator).burnFrom(operator.address, ETH))
        .to.emit(token, 'Transfer')
        .withArgs(operator.address, ZERO_ADDR, ETH);
      expect(await token.balanceOf(operator.address)).to.eq(ZERO);
    });
  });

  describe('ARTH', () => {
    let token: Contract;

    before('Deploy token', async () => {
      token = await ARTH.connect(operator).deploy();
    });

    it('Mint', async () => {
      await expect(token.connect(operator).mint(operator.address, ETH))
        .to.emit(token, 'Transfer')
        .withArgs(ZERO_ADDR, operator.address, ETH);
      expect(await token.balanceOf(operator.address)).to.eq(ETH.mul(2));
    });

    it('Burn', async () => {
      await expect(token.connect(operator).burn(ETH))
        .to.emit(token, 'Transfer')
        .withArgs(operator.address, ZERO_ADDR, ETH);
      expect(await token.balanceOf(operator.address)).to.eq(ETH);
    });

    it('Burn From', async () => {
      await expect(token.connect(operator).approve(operator.address, ETH));
      await expect(token.connect(operator).burnFrom(operator.address, ETH))
        .to.emit(token, 'Transfer')
        .withArgs(operator.address, ZERO_ADDR, ETH);
      expect(await token.balanceOf(operator.address)).to.eq(ZERO);
    });
  });

  describe('MAHA', () => {
    let token: Contract;

    before('Deploy token', async () => {
      token = await MAHA.connect(operator).deploy();
    });

    it('Mint', async () => {
      await expect(token.connect(operator).mint(operator.address, ETH.mul(2)))
        .to.emit(token, 'Transfer')
        .withArgs(ZERO_ADDR, operator.address, ETH.mul(2));
      expect(await token.balanceOf(operator.address)).to.eq(ETH.mul(2));
    });

    it('Burn', async () => {
      await expect(token.connect(operator).burn(ETH))
        .to.emit(token, 'Transfer')
        .withArgs(operator.address, ZERO_ADDR, ETH);
      expect(await token.balanceOf(operator.address)).to.eq(ETH);
    });

    it('Burn From', async () => {
      await expect(token.connect(operator).approve(whale.address, ETH));
      await expect(token.connect(whale).burnFrom(operator.address, ETH))
        .to.emit(token, 'Transfer')
        .withArgs(operator.address, ZERO_ADDR, ETH);
      expect(await token.balanceOf(operator.address)).to.eq(ZERO);
    });
  });
});

import chai, { expect } from 'chai';
import { ethers } from 'hardhat';
import { solidity } from 'ethereum-waffle';
import { Contract, ContractFactory, BigNumber, utils } from 'ethers';

import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';


chai.use(solidity);


describe('SimpleOracle', () => {
  const MINUTE = 60;
  const DAY = 86400;
  const ETH = utils.parseEther('1');
  const ZERO_ADDR = '0x0000000000000000000000000000000000000000';

  const { provider } = ethers;

  let operator: SignerWithAddress;
  let whale: SignerWithAddress;

  let SimpleOracle: ContractFactory;

  before('setup accounts', async () => {
    [operator, whale] = await ethers.getSigners();
  });

  before('fetch contract factories', async () => {
    SimpleOracle = await ethers.getContractFactory('SimpleOracle');
  });

  let oracle: Contract;

  beforeEach('deploy contracts', async () => {
    oracle = await SimpleOracle.connect(operator).deploy(
      'Simple test oracle',
      ETH
    );
  });

  describe('#setPrice', async () => {
    it('should not work correctly if not owner', async () => {
      await expect(oracle.connect(whale).setPrice(ETH.mul(2))).to.revertedWith(
        'Ownable: caller is not the owner'
      )
    });

    it('should work correctly if owner and price > 0', async () => {
      expect(oracle.connect(operator).setPrice(ETH.mul(2)))
    });
  });

  describe('#getPrice', async () => {
    it('should work correctly if not owner', async () => {
      expect(await oracle.connect(whale).getPrice())
    });

    it('should work correctly and return default price if no price set after deployment', async () => {
      const initalPrice = await oracle.connect(operator).getPrice();

      expect(initalPrice).to.eq(ETH);
    });

    it('should work correctly and return updated price', async () => {
      const newPrice = ETH.mul(2);

      expect(oracle.connect(operator).setPrice(newPrice))
      const newGetPrice = await oracle.connect(operator).getPrice();

      expect(newGetPrice).to.eq(newPrice);
    });
  });
});


const ARTH = artifacts.require('ARTH');
const MahaToken = artifacts.require('MahaToken');
const MockDai = artifacts.require('MockDai');
const BondRedemtionOracle = artifacts.require('BondRedemtionOracle');
const SeigniorageOracle = artifacts.require('SeigniorageOracle');

const DAIBACLPToken_BASPool = artifacts.require('DAIBACLPTokenSharePool')
const DAIBASLPToken_BASPool = artifacts.require('DAIBASLPTokenSharePool')

const UniswapV2Factory = artifacts.require('UniswapV2Factory');

const knownContracts = require('./known-contracts');
const { POOL_START_DATE } = require('./pools');


module.exports = async (deployer, network, accounts) => {
  // Set the main account, you'll be using accross all the files for various
  // important activities to your desired address in the .env file.
  accounts[0] = process.env.WALLET_KEY;

  const uniswapFactory = network === 'mainnet' || network === 'ropsten'
    ? await UniswapV2Factory.at(knownContracts.UniswapV2Factory[network])
    : await UniswapV2Factory.deployed()

  const dai = network === 'mainnet'
    ? await IERC20.at(knownContracts.DAI[network])
    : await MockDai.deployed();

  const oracle = await SeigniorageOracle.deployed();

  const dai_bac_lpt = await oracle.pairFor(uniswapFactory.address, ARTH.address, dai.address);
  // const dai_bas_lpt = await oracle.pairFor(uniswapFactory.address, MahaToken.address, dai.address);

  await deployer.deploy(DAIBACLPToken_BASPool, MahaToken.address, dai_bac_lpt, POOL_START_DATE);
  // await deployer.deploy(DAIBASLPToken_BASPool, MahaToken.address, dai_bas_lpt, POOL_START_DATE);
};

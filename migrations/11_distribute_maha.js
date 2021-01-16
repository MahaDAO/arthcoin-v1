const { FACTORY_ADDRESS, INIT_CODE_HASH } = require('@uniswap/sdk')
const { pack, keccak256 } = require('@ethersproject/solidity')
const { getCreate2Address } = require('@ethersproject/address')

const knownContracts = require('./known-contracts');
const { POOL_START_DATE } = require('./pools');

const Arth = artifacts.require('Arth');
const MahaToken = artifacts.require('MahaToken');
// const Oracle = artifacts.require('MockOracle');
const MockDai = artifacts.require('MockDai');
const IERC20 = artifacts.require('IERC20');

const MAHAARTHPool = artifacts.require('MAHAARTHPool')
const MAHADAIARTHLPTokenPool = artifacts.require('MAHADAIARTHLPTokenPool')
const MAHAMAHAETHLPTokenPool = artifacts.require('MAHAMAHAETHLPTokenPool')


module.exports = async (deployer, network, accounts) => {
  const dai = network === 'mainnet'
    ? await IERC20.at(knownContracts.DAI[network])
    : await MockDai.deployed();

  const arth = await Arth.deployed();
  const mahaToken = network === 'mainnet'
    ? await MahaToken.at(knownContracts.MahaToken[network])
    : await MahaToken.deployed();

  const dai_arth_lpt = getCreate2Address(
    FACTORY_ADDRESS,
    keccak256(['bytes'], [pack(['address', 'address'], [dai.address, arth.address])]),
    INIT_CODE_HASH
  )

  const maha_dai_lpt = getCreate2Address(
    FACTORY_ADDRESS,
    keccak256(['bytes'], [pack(['address', 'address'], [dai.address, mahaToken.address])]),
    INIT_CODE_HASH
  );

  const maha_eth_lpt = network === 'mainnet'
    ? knownContracts.MAHA_ETH_LP[network]
    : maha_dai_lpt;

  await deployer.deploy(MAHADAIARTHLPTokenPool, mahaToken.address, dai_arth_lpt, POOL_START_DATE);
  await deployer.deploy(MAHAMAHAETHLPTokenPool, mahaToken.address, maha_eth_lpt, POOL_START_DATE);
  await deployer.deploy(MAHAARTHPool, mahaToken.address, arth.address, POOL_START_DATE);
};

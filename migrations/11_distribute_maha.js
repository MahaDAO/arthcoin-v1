const knownContracts = require('./known-contracts');
const { POOL_START_DATE } = require('./pools');
const { BigNumber } = require('ethers');
const { getDAI, getMahaToken, getPairAddress, isMainnet } = require('./helpers');

const Arth = artifacts.require('ARTH');

const MAHAARTHPool = artifacts.require('MAHAARTHPool')
const MAHADAIARTHLPTokenPool = artifacts.require('MAHADAIARTHLPTokenPool')
const MAHAMAHAETHLPTokenPool = artifacts.require('MAHAMAHAETHLPTokenPool')


module.exports = async (deployer, network, accounts) => {
  const dai = await getDAI(network, deployer, artifacts);
  const mahaToken = await getMahaToken(network, deployer, artifacts);
  const arth = await Arth.deployed();

  const dai_arth_lpt = getPairAddress(
    dai.address,
    arth.address,
    network, deployer, artifacts
  );

  const maha_dai_lpt = getPairAddress(
    dai.address,
    mahaToken.address,
    network, deployer, artifacts
  );

  const maha_eth_lpt = isMainnet(network)
    ? knownContracts.MAHA_ETH_LP[network]
    : maha_dai_lpt;

  await deployer.deploy(MAHADAIARTHLPTokenPool, mahaToken.address, dai_arth_lpt, POOL_START_DATE);
  await deployer.deploy(MAHAMAHAETHLPTokenPool, mahaToken.address, maha_eth_lpt, POOL_START_DATE);
  await deployer.deploy(MAHAARTHPool, mahaToken.address, arth.address, POOL_START_DATE);

  if (!isMainnet(network)) {
    const decimals = BigNumber.from(10).pow(18);
    mahaToken.mint(MAHADAIARTHLPTokenPool.address, BigNumber.from(4000).mul(decimals));
    mahaToken.mint(MAHAMAHAETHLPTokenPool.address, BigNumber.from(4000).mul(decimals));
    mahaToken.mint(MAHAARTHPool.address, BigNumber.from(2000).mul(decimals));
  }
};

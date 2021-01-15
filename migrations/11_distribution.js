const { arthCommunityPools } = require('./pools');
const { BigNumber } = require('ethers');

/**
 * Tokens deployed first.
 */
const ARTH = artifacts.require('ARTH');
const ARTHMultiTokenPool = artifacts.require('ARTHMultiTokenPool');
const ARTHMahaPool = artifacts.require('ARTHMahaPool');
const ARTHMahaEthLPPool = artifacts.require('ARTHMahaEthLPPool');
const InitialCashDistributor = artifacts.require('InitialCashDistributor');
const MahaToken  = artifacts.require('MahaToken');

/**
 * Main migrations
 */
module.exports = async (deployer, network, accounts) => {
  // Set the main account, you'll be using accross all the files for various
  // important activities to your desired address in the .env file.
  accounts[0] = process.env.WALLET_KEY;

  const POOL_START_DATE = network === 'mainnet' ?  Math.floor(new Date("Fri Jan 15 2021 15:00:10 GMT+0000").getTime() / 1000) : Math.floor(Date.now() / 1000);

  const cash = await ARTH.deployed();

  // create the community pool
  await deployer.deploy(ARTHMahaPool, ARTH.address, MahaToken.address, POOL_START_DATE);
  await deployer.deploy(ARTHMahaEthLPPool, ARTH.address, MahaToken.address, POOL_START_DATE);
  await deployer.deploy(ARTHMultiTokenPool, ARTH.address, POOL_START_DATE);

  const communityPool = await ARTHMultiTokenPool.deployed();
  const mahalpPool = await ARTHMahaEthLPPool.deployed();
  const mahapool = await ARTHMahaPool.deployed();

  // register all the tokens
  const decimals = BigNumber.from(10).pow(18);
  const tokens = arthCommunityPools.map(m => m.address);
  const tokenNames = arthCommunityPools.map(m => m.name);
  const tokenAmounts = arthCommunityPools.map(m => BigNumber.from(m.amount).mul(decimals));
  console.log('registering the following tokens to the community pool', tokenNames.join(', '));
  communityPool.registerTokens(tokens, tokenAmounts);

  // deposit ARTH into distributor, connect the pools and send it!
  const distributor = await deployer.deploy(
    InitialCashDistributor,
    ARTH.address,
    tokens,

    // pools
    accounts[0],
    ARTHMultiTokenPool.address,
    ARTHMahaPool.address,
    ARTHMahaEthLPPool.address,

    // give away 500k ARTH
    BigNumber.from(500000).mul(decimals)
  );

  await mahapool.setRewardDistribution(InitialCashDistributor.address);
  await mahalpPool.setRewardDistribution(InitialCashDistributor.address);
  await communityPool.setRewardDistribution(InitialCashDistributor.address);

  await cash.mint(InitialCashDistributor.address, decimals.mul(500000));
  await distributor.distribute();
};
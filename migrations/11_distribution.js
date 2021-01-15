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


/**
 * Main migrations
 */
module.exports = async (deployer, network, accounts) => {
  // Set the main account, you'll be using accross all the files for various
  // important activities to your desired address in the .env file.
  accounts[0] = process.env.WALLET_KEY;

  const POOL_START_DATE = network === 'mainnet' ?  Math.floor(new Date("Fri Jan 15 2021 15:00:10 GMT+0000").getTime() / 1000) : Math.floor(Date.now() / 1000);

  // create the community pool
  const mahaPool = await deployer.deploy(ARTHMahaPool, ARTH.address, MahaToken.address, POOL_START_DATE);
  const lpPool = await deployer.deploy(ARTHMahaEthLPPool, ARTH.address, MahaToken.address, POOL_START_DATE);
  const communityPool = await deployer.deploy(ARTHMultiTokenPool, ARTH.address, POOL_START_DATE);

  // register all the tokens
  const tokens = arthCommunityPools.map(m => m.address);
  const tokenNames = arthCommunityPools.map(m => m.name);
  const tokenAmounts = arthCommunityPools.map(m => m.amount);
  console.log('registering the following tokens to the community pool', tokenNames.join(', '))
  communityPool.registerTokens(tokens, tokenAmounts);

  // deposit ARTH into distributor, connect the pools and send it!
  await deployer.deploy(
    InitialCashDistributor,
    ARTH.address,
    tokenAmounts,

    // pools
    accounts[0],
    communityPool.address,
    mahaPool.address,
    lpPool.address,

    // give away 500k ARTH
    BigNumber.from(500000).mul(1e18)
  );
};
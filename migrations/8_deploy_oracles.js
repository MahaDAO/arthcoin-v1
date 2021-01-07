const ARTH = artifacts.require('ARTH');
const MockDai = artifacts.require('MockDai');
const GMUOracle = artifacts.require('GMUOracle');
const MAHAUSDOracle = artifacts.require('MAHAUSDOracle');
const UniswapV2Factory = artifacts.require('UniswapV2Factory');
const SeigniorageOracle = artifacts.require('SeigniorageOracle');
const BondRedemtionOracle = artifacts.require('BondRedemtionOracle');

const { POOL_START_DATE, DAY, HOUR } = require('./config');
const knownContracts = require('./known-contracts');


async function migration(deployer, network, accounts) {
  // Set the main account, you'll be using accross all the files for
  // various important activities to your desired address in the .env
  // file.
  accounts[0] = process.env.WALLET_KEY;

  // Set starttime for different networks.
  const startTime = POOL_START_DATE;
  if (network === 'mainnet') {
    startTime += 5 * DAY;
  }
  
  // Deploy dai or fetch deployed dai.
  console.log(`Fetching dai on ${network} network.`);
  const dai = network === 'mainnet'
    ? await IERC20.at(knownContracts.DAI[network])
    : await MockDai.deployed();
  
  // Fetching deployed ARTH.
  const cash = await ARTH.deployed();
  
  // Fetch the deployed uniswap contract.
  const uniswap= network === 'mainnet' || network === 'ropsten'
    ? await UniswapV2Factory.at(knownContracts.UniswapV2Factory[network])
    : await UniswapV2Factory.deployed()

  // Deploy oracle for the pair between ARTH and Dai.
  console.log('Deploying bond oracle.')
  await deployer.deploy(
    BondRedemtionOracle,
    uniswap.address,
    cash.address, // NOTE YA: I guess bond oracle is for dai - cash pool.
    dai.address,
    2 * HOUR, // In hours for dev deployment purpose.
    startTime
  );

  // Deploy seigniorage oracle.
  console.log('Deploying seigniorage oracle.')
  await deployer.deploy(
    SeigniorageOracle,
    uniswap.address,
    cash.address,
    dai.address,
    2 * HOUR, // In hours for dev deployment purpose.
    startTime
  );

  // Deploy the GMU oracle.
  console.log('Deploying GMU oracle.')
  const gmuOrale = await deployer.deploy(GMUOracle, 'GMU');
  await gmuOrale.setPrice(web3.utils.toBN(1e18).toString()); // Set starting price to be 1$.

  // Deploy MAHAUSD oracle.
  console.log('Deploying MAHAUSD oracle.')
  const mahausdOracle = await deployer.deploy(MAHAUSDOracle, 'MAHA-USD');
  await mahausdOracle.setPrice(web3.utils.toBN(1e18).toString()); // Set starting price to be 1$.
}


module.exports = migration;

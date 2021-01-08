const { POOL_START_DATE, DAY, KNOWN_CONTRACTS } = require('./config');


const ARTH = artifacts.require('ARTH');
const MockDai = artifacts.require('MockDai');
const GMUOracle = artifacts.require('GMUOracle');
const MAHAUSDOracle = artifacts.require('MAHAUSDOracle');
const UniswapV2Factory = artifacts.require('UniswapV2Factory');
const SeigniorageOracle = artifacts.require('SeigniorageOracle');
const BondRedemtionOracle = artifacts.require('BondRedemtionOracle');


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

  const ORACLE_START_PRICE = web3.utils.toBN(1e18).toString();
  const GMU_ORACLE_START_PRICE = ORACLE_START_PRICE;
  const MAHAUSD_ORACLE_START_PRICE = ORACLE_START_PRICE;

  const ORACLE_PERIOD = 5 * 60;
  const BOND_ORACLE_PERIOD = ORACLE_PERIOD;
  const SEIGNIORAGE_ORACLE_PERIOD = ORACLE_PERIOD;

  // Deploy dai or fetch deployed dai.
  console.log(`Fetching dai on ${network} network.`);
  const dai = network === 'mainnet'
    ? await IERC20.at(KNOWN_CONTRACTS.DAI[network])
    : await MockDai.deployed();

  // Fetching deployed ARTH.
  const cash = await ARTH.deployed();

  // Fetch the deployed uniswap contract.
  const uniswap = network === 'mainnet' || network === 'ropsten'
    ? await UniswapV2Factory.at(KNOWN_CONTRACTS.UniswapV2Factory[network])
    : await UniswapV2Factory.deployed()

  // Deploy oracle for the pair between ARTH and Dai.
  console.log('Deploying bond oracle.')
  await deployer.deploy(
    BondRedemtionOracle,
    uniswap.address,
    cash.address, // NOTE YA: I guess bond oracle is for dai - cash pool.
    dai.address,
    BOND_ORACLE_PERIOD, // In hours for dev deployment purpose.
    startTime
  );

  // Deploy seigniorage oracle.
  console.log('Deploying seigniorage oracle.')
  await deployer.deploy(
    SeigniorageOracle,
    uniswap.address,
    cash.address,
    dai.address,
    SEIGNIORAGE_ORACLE_PERIOD, // In hours for dev deployment purpose.
    startTime
  );

  // Deploy the GMU oracle.
  console.log('Deploying GMU oracle.')
  await deployer.deploy(GMUOracle, 'GMU', GMU_ORACLE_START_PRICE);

  // Deploy MAHAUSD oracle.
  console.log('Deploying MAHAUSD oracle.')
  await deployer.deploy(MAHAUSDOracle, 'MAHA-USD', MAHAUSD_ORACLE_START_PRICE);
}


module.exports = migration;

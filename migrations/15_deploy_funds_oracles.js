const knownContracts = require('./known-contracts');
const { POOL_START_DATE, DAY } = require('./config');


const ARTH = artifacts.require('ARTH');
const MAHA = artifacts.require('MahaToken');
const MockDai = artifacts.require('MockDai');
const IERC20 = artifacts.require('IERC20');

const GMUOracle = artifacts.require('GMUOracle');
const UniswapV2Factory = artifacts.require('UniswapV2Factory');
const UniswapV2Router02 = artifacts.require('UniswapV2Router02');

const ArthMahaOracle = artifacts.require("ArthMahaOracle");
const SeigniorageOracle = artifacts.require('SeigniorageOracle');
const BondRedemtionOracle = artifacts.require('BondRedemtionOracle');
const DevelopmentFund = artifacts.require('DevelopmentFund');


async function migration(deployer, network, accounts) {
  // Set the main account, you'll be using accross all the files for
  // various important activities to your desired address in the .env
  // file.
  accounts[0] = process.env.WALLET_KEY;

  // Set starttime for different networks.
  // jan 22nd 3pm GMT
  let startTime = Math.floor(new Date('2021-01-22T15:00:00Z') / 1000);
  if (network !== 'mainnet') {
    startTime = Math.floor(Date.now() / 1000);
  }

  // Deploy funds.
  console.log('Deploying funds.')
  await deployer.deploy(DevelopmentFund);

  const ORACLE_START_PRICE = web3.utils.toBN(1e18).toString();
  const GMU_ORACLE_START_PRICE = ORACLE_START_PRICE;

  const ORACLE_PERIOD = 10 * 60;
  const BOND_ORACLE_PERIOD = ORACLE_PERIOD;
  const SEIGNIORAGE_ORACLE_PERIOD = ORACLE_PERIOD;

  // Deploy dai or fetch deployed dai.
  console.log(`Fetching dai on ${network} network.`);
  const dai = network === 'mainnet'
    ? await IERC20.at(knownContracts.DAI[network])
    : await MockDai.deployed();

  // Fetching deployed ARTH & MAHA.
  const cash = await ARTH.deployed();

  // Fetch the deployed uniswap factory contract.
  const uniswap = network === 'mainnet' || network === 'ropsten'  || network === 'kovan'
    ? await UniswapV2Factory.at(knownContracts.UniswapV2Factory[network])
    : await UniswapV2Factory.deployed();

  // Fetch the deployed uniswap router contract.
  const uniswapRouter = network === 'mainnet' || network === 'ropsten'  || network === 'kovan'
    ? await UniswapV2Router02.at(knownContracts.UniswapV2Router02[network])
    : await UniswapV2Router02.deployed();

  // Deploy oracle for the pair between ARTH and Dai.
  console.log('Deploying bond oracle.');
  await deployer.deploy(
    BondRedemtionOracle,
    uniswap.address,
    cash.address,
    dai.address,
    BOND_ORACLE_PERIOD,
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

  // Deploy maha-dai oracle.
  console.log('Deploying mahadai oracle.')
  await deployer.deploy(ArthMahaOracle);

  // Deploy the GMU oracle.
  console.log('Deploying GMU oracle.')
  await deployer.deploy(GMUOracle);
}


module.exports = migration;

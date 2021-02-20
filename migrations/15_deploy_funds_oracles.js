const { getPairAddress, getDAI } = require('./helpers');

const ARTH = artifacts.require('ARTH');
const GMUOracle = artifacts.require('GMUOracle');
const TWAP12hrOracle = artifacts.require('TWAP12hrOracle');
const TWAP1hrOracle = artifacts.require('TWAP1hrOracle');
const DevelopmentFund = artifacts.require('DevelopmentFund');
const RainyDayFund = artifacts.require('RainyDayFund');


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
  console.log('Deploying funds.');
  await deployer.deploy(DevelopmentFund);
  await deployer.deploy(RainyDayFund);

  const ORACLE_PERIOD = 10 * 60;
  const TWAP1hr_PERIOD = ORACLE_PERIOD;
  const TWAP12hr_PERIOD = ORACLE_PERIOD;

  // Deploy dai or fetch deployed dai.
  const dai = await getDAI(network, deployer, artifacts);
  const cash = await ARTH.deployed();
  const pairAddress = await getPairAddress(cash.address, dai.address, network, deployer, artifacts);

  // Deploy oracle for the pair between ARTH and Dai.
  console.log('Deploying bond oracle.');
  await deployer.deploy(TWAP1hrOracle, pairAddress, TWAP1hr_PERIOD, startTime);

  // Deploy seigniorage oracle.
  console.log('Deploying seigniorage oracle.')
  await deployer.deploy(TWAP12hrOracle, pairAddress, TWAP12hr_PERIOD, startTime);

  // Deploy the GMU oracle.
  console.log('Deploying GMU oracle.')
  await deployer.deploy(GMUOracle);
}


module.exports = migration;

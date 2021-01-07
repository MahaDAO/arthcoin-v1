const ARTH = artifacts.require('ARTH');
const ARTHB = artifacts.require('ARTHB');
const MahaToken = artifacts.require('MahaToken');
const DevelopmentFund = artifacts.require('DevelopmentFund');
const BurnbackFund = artifacts.require('BurnbackFund');
const BondRedemtionOracle = artifacts.require('BondRedemtionOracle');
const Treasury = artifacts.require('Treasury');
const ArthLiquidityBoardroom = artifacts.require('ArthLiquidityBoardroom');
const ArthBoardroom = artifacts.require('ArthBoardroom');
const GMUOracle = artifacts.require('GMUOracle');
const MAHAUSDOracle = artifacts.require('MAHAUSDOracle');
const SeigniorageOracle = artifacts.require('SeigniorageOracle');


const { POOL_START_DATE, DAY, HOUR } = require('./config');

// Set starttime for different networks.
  const startTime = POOL_START_DATE;
  if (network === 'mainnet') {
    startTime += 5 * DAY;
  }
  
async function migration(deployer, network, accounts) {
  // Set the main account, you'll be using accross all the files for
  // various important activities to your desired address in the .env
  // file.
  accounts[0] = process.env.WALLET_KEY;

  console.log('Deploying treasury.')
  const treasurey = await deployer.deploy(
    Treasury,
    ARTH.address,
    ARTHB.address,
    MahaToken.address,
    BondRedemtionOracle.address,
    MAHAUSDOracle.address,
    SeigniorageOracle.address,
    ArthLiquidityBoardroom.address,
    ArthBoardroom.address,
    DevelopmentFund.address,
    BurnbackFund.address,
    GMUOracle.address,
    startTime,
  );
}


module.exports = migration;

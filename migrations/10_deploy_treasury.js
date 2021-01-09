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


async function migration(deployer, network, accounts) {
  // Set the main account, you'll be using accross all the files for
  // various important activities to your desired address in the .env
  // file.
  accounts[0] = process.env.WALLET_KEY;

  // Set starttime for different networks.
  let POOL_START_DATE = Math.floor(Date.now() / 1000);
  let TREASURY_PERIOD = 12 * 60 * 60;

  if (network === 'mainnet') {
    POOL_START_DATE += 5 * DAY;
  } else {
    TREASURY_PERIOD = 60 * 60;
  }


  console.log('Deploying treasury.')
  await deployer.deploy(
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
    POOL_START_DATE,
    TREASURY_PERIOD
  );
}


module.exports = migration;
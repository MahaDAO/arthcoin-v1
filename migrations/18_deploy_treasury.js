const { getMahaToken, getUniswapRouter, getDAI, isMainnet, getPairAddress } = require('./helpers');

const ARTH = artifacts.require('ARTH');
const ARTHB = artifacts.require('ARTHB');
const TWAP1hrOracle = artifacts.require('TWAP1hrOracle');
const GMUOracle = artifacts.require('GMUOracle');
const TWAP12hrOracle = artifacts.require('TWAP12hrOracle');

const Treasury = artifacts.require('Treasury');
const TreasuryLibrary = artifacts.require('TreasuryLibrary');

const ArthArthBoardroomV2 = artifacts.require('ArthArthBoardroomV2');
const ArthArthMlpLiquidityBoardroomV2 = artifacts.require('ArthArthMlpLiquidityBoardroomV2')
const ArthMahaBoardroomV2 = artifacts.require('ArthMahaBoardroomV2');
const MahaArthBoardroomV2 = artifacts.require('MahaArthBoardroomV2');
const MahaArthMlpLiquidityBoardroomV2 = artifacts.require('MahaArthMlpLiquidityBoardroomV2');
const MahaMahaBoardroomV2 = artifacts.require('MahaMahaBoardroomV2');

const Maharaja = artifacts.require('Maharaja');

const DevelopmentFund = artifacts.require('DevelopmentFund');
const RainyDayFund = artifacts.require('RainyDayFund');


async function migration(deployer, network, accounts) {
  // Set the main account, you'll be using accross all the files for
  // various important activities to your desired address in the .env
  // file.
  accounts[0] = process.env.WALLET_KEY;

  // Set starttime for different networks.
  // jan 22nd 4pm GMT
  let startTime = Math.floor(new Date('2021-01-22T14:00:00Z') / 1000);
  let POOL_START_DATE = network === 'mainnet' ? startTime : Math.floor(Date.now() / 1000) + 60;
  let TREASURY_PERIOD = isMainnet(network) ? 12 * 60 * 60 : 1 * 60;

  const dai = await getDAI(network, deployer, artifacts);
  const uniswapRouter = await getUniswapRouter(network, deployer, artifacts);
  const lpToken = await getPairAddress(dai.address, ARTH.address, network, deployer, artifacts);
  const mahaToken = await getMahaToken(network, deployer, artifacts);

  const maharaja = await Maharaja.deployed();


  console.log('Deploying treasury library.');

  await deployer.deploy(TreasuryLibrary);
  await deployer.link(TreasuryLibrary, Treasury);

  console.log('Deploying treasury');
  await deployer.deploy(
    Treasury,
    Maharaja.address,
    dai.address,
    ARTH.address,
    ARTHB.address,
    mahaToken.address,
    uniswapRouter.address,
    lpToken,
    POOL_START_DATE,
    TREASURY_PERIOD,
    0
  );

  const treasury = await Treasury.deployed();

  console.log('granting operator access');
  await maharaja.grantOperator(treasury.address);

  console.log('set all funds');
  await treasury.setAllFunds(
    ArthArthMlpLiquidityBoardroomV2.address,
    ArthMahaBoardroomV2.address,
    ArthArthBoardroomV2.address,
    MahaArthMlpLiquidityBoardroomV2.address,
    MahaMahaBoardroomV2.address,
    MahaArthBoardroomV2.address,

    DevelopmentFund.address,
    RainyDayFund.address
  );

  console.log('setting oracles')
  await treasury.setOracles(
    TWAP1hrOracle.address,
    TWAP12hrOracle.address,
    GMUOracle.address,
  );
}


module.exports = migration;

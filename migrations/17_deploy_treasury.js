const knownContracts = require('./known-contracts');

const ARTH = artifacts.require('ARTH');
const ARTHB = artifacts.require('ARTHB');
const BondRedemtionOracle = artifacts.require('BondRedemtionOracle');
const GMUOracle = artifacts.require('GMUOracle');
const MahaToken = artifacts.require('MahaToken');
const ArthMahaOracle = artifacts.require("ArthMahaTestnetOracle");
const MockDai = artifacts.require('MockDai');
const SeigniorageOracle = artifacts.require('SeigniorageOracle');
const Treasury = artifacts.require('Treasury');
const UniswapV2Router02 = artifacts.require('UniswapV2Router02');

const ArthBoardroom = artifacts.require('ArthBoardroomV2');
const ArthUniLiquidityBoardroomV2 = artifacts.require('ArthUniLiquidityBoardroomV2');
const ArthMlpLiquidityBoardroomV2 = artifacts.require('ArthMlpLiquidityBoardroomV2');

const DevelopmentFund = artifacts.require('DevelopmentFund');
const MahaLiquidityBoardroom = artifacts.require('MahaLiquidityBoardroomV2');


async function migration(deployer, network, accounts) {
  // Set the main account, you'll be using accross all the files for
  // various important activities to your desired address in the .env
  // file.
  accounts[0] = process.env.WALLET_KEY;

  const dai = network === 'mainnet'
    ? await IERC20.at(knownContracts.DAI[network])
    : await MockDai.deployed();

  const uniswapRouter = network === 'mainnet' || network === 'ropsten' || network === 'kovan'
    ? await UniswapV2Router02.at(knownContracts.UniswapV2Router02[network])
    : await UniswapV2Router02.deployed();

  // Set starttime for different networks.
  // jan 22nd 4pm GMT
  let startTime = Math.floor(new Date('2021-01-22T14:00:00Z') / 1000);

  const mahaToken = network === 'mainnet'
    ? await MahaToken.at(knownContracts.MahaToken[network])
    : await MahaToken.deployed();

  let POOL_START_DATE = network === 'mainnet' ? startTime : Math.floor(Date.now() / 1000) + 60;
  let TREASURY_PERIOD = network === 'mainnet' ? 12 * 60 * 60 : 1 * 60

  console.log('Deploying treasury.')

  const treasury = await deployer.deploy(
    Treasury,
    dai.address,
    ARTH.address,
    ARTHB.address,
    mahaToken.address,

    BondRedemtionOracle.address,
    ArthMahaOracle.address,
    SeigniorageOracle.address,
    GMUOracle.address,

    uniswapRouter.address,
    POOL_START_DATE,
    TREASURY_PERIOD,
    0
  );

  await treasury.setBoardrooms(
    ArthUniLiquidityBoardroomV2.address,
    ArthMlpLiquidityBoardroomV2.address,
    MahaLiquidityBoardroom.address,
    ArthBoardroom.address,
    DevelopmentFund.address
  );
}


module.exports = migration;

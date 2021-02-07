const knownContracts = require('./known-contracts');


const ARTH = artifacts.require('ARTH');
const IERC20 = artifacts.require('IERC20');
const MockDai = artifacts.require('MockDai');
const ArthBoardroom = artifacts.require('ArthBoardroomV2');
const UniswapV2Factory = artifacts.require('UniswapV2Factory');
const BondRedemtionOracle = artifacts.require('BondRedemtionOracle');
const ArthLiquidityBoardroom = artifacts.require('ArthLiquidityBoardroomV2');
const MahaLiquidityBoardroom = artifacts.require('MahaLiquidityBoardroomV2');


async function migration(deployer, network, accounts) {
  // Set the main account, you'll be using accross all the files for
  // various important activities to your desired address in the .env
  // file.
  accounts[0] = process.env.WALLET_KEY;

  const DAY = 86400;
  const HOUR = 3600;
  const REWARDS_VESTING = network === 'mainnet' ? 8 * HOUR : HOUR;
  const ARTH_BOARDROOM_LOCK_DURATION = network === 'mainnet' ? 5 * DAY : HOUR * 5;
  const LIQUIDITY_BOARDROOM_LOCK_DURATION = network === 'mainnet' ? 1 * DAY : HOUR * 5;

  // Deploy dai or fetch deployed dai.
  console.log(`Fetching dai on ${network} network.`);
  const dai = network === 'mainnet'
    ? await IERC20.at(knownContracts.DAI[network])
    : await MockDai.deployed();

  // Fetching deployed ARTH.
  const cash = await ARTH.deployed();

  // Fetch the bond oracle.
  const bondRedemtionOralce = await BondRedemtionOracle.deployed();

  // Fetch the deployed uniswap.
  const uniswap = network === 'mainnet' || network === 'ropsten' || network === 'kovan'
    ? await UniswapV2Factory.at(knownContracts.UniswapV2Factory[network])
    : await UniswapV2Factory.deployed();

  // Get the oracle pair of ARTH-DAI.
  const dai_arth_lpt = network === 'mainnet'
    ? knownContracts.ARTH_DAI_LP[network]
    : await bondRedemtionOralce.pairFor(uniswap.address, cash.address, dai.address);

  const maha_weth_lpt = network === 'mainnet'
    ? knownContracts.MAHA_ETH_LP[network]
    : await bondRedemtionOralce.pairFor(uniswap.address, cash.address, dai.address);

  // Deploy ARTH-DAI liquidity boardroom.
  await deployer.deploy(ArthLiquidityBoardroom, cash.address, dai_arth_lpt, LIQUIDITY_BOARDROOM_LOCK_DURATION, REWARDS_VESTING);

  // Deploy arth boardroom.
  await deployer.deploy(ArthBoardroom, cash.address, ARTH_BOARDROOM_LOCK_DURATION, REWARDS_VESTING);

  // Deploy MAHA-ETH boardroom.
  await deployer.deploy(MahaLiquidityBoardroom, cash.address, maha_weth_lpt, LIQUIDITY_BOARDROOM_LOCK_DURATION, REWARDS_VESTING);
}


module.exports = migration;

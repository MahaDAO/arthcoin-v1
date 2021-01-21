const {
  ARTH_LIQUIDITY_BOARDROOM_LOCK_DURATION,
  ARTH_BOARDROOM_LOCK_DURATION
} = require('./config');
const knownContracts = require('./known-contracts');


const ARTH = artifacts.require('ARTH');
const MockDai = artifacts.require('MockDai');
const ArthBoardroom = artifacts.require('ArthBoardroom');
const UniswapV2Factory = artifacts.require('UniswapV2Factory');
const BondRedemtionOracle = artifacts.require('BondRedemtionOracle');
const ArthLiquidityBoardroom = artifacts.require('ArthLiquidityBoardroom');
const MahaLiquidityBoardroom = artifacts.require('MahaLiquidityBoardroom');


async function migration(deployer, network, accounts) {
  // Set the main account, you'll be using accross all the files for
  // various important activities to your desired address in the .env
  // file.
  accounts[0] = process.env.WALLET_KEY;

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
  const uniswap = network === 'mainnet' || network === 'ropsten'
    ? await UniswapV2Factory.at(knownContracts.UniswapV2Factory[network])
    : await UniswapV2Factory.deployed();

  // Get the oracle pair of ARTH-DAI.
  const dai_arth_lpt = await bondRedemtionOralce.pairFor(uniswap.address, cash.address, dai.address);

  // Deploy ARTH-DAI liquidity boardroom.
  await deployer.deploy(ArthLiquidityBoardroom, cash.address, dai_arth_lpt, ARTH_LIQUIDITY_BOARDROOM_LOCK_DURATION);

  // Deploy arth boardroom.
  await deployer.deploy(ArthBoardroom, cash.address, ARTH_BOARDROOM_LOCK_DURATION);

  // Deploy MAHA-ETH boardroom.
  await deployer.deploy(MahaLiquidityBoardroom, cash.address, dai_arth_lpt, ARTH_BOARDROOM_LOCK_DURATION);
}


module.exports = migration;

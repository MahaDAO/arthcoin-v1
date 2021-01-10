const knownContracts = require('./known-contracts');
const ethers = require('ethers')

const ARTH = artifacts.require('ARTH');
const ARTHB = artifacts.require('ARTHB');
const ArthBoardroom = artifacts.require('ArthBoardroom');
const ArthLiquidityBoardroom = artifacts.require('ArthLiquidityBoardroom');
const BondRedemtionOracle = artifacts.require('BondRedemtionOracle');
const DevelopmentFund = artifacts.require('DevelopmentFund');
const GMUOracle = artifacts.require('GMUOracle');
const MahaToken = artifacts.require('MahaToken');
const MAHAUSDOracle = artifacts.require('MAHAUSDOracle');
const MockDai = artifacts.require('MockDai');
const SeigniorageOracle = artifacts.require('SeigniorageOracle');
const Treasury = artifacts.require('Treasury');
const UniswapV2Router02 = artifacts.require('UniswapV2Router02');

async function approveIfNot(token, owner, spender, amount) {
  const allowance = await token.allowance(owner, spender);

  if (web3.utils.toBN(allowance).gte(web3.utils.toBN(amount))) {
    return;
  }

  await token.approve(spender, amount);
  console.log(` - Approved ${token.symbol ? (await token.symbol()) : token.address}`);
}

async function migration(deployer, network, accounts) {
  // Set the main account, you'll be using accross all the files for
  // various important activities to your desired address in the .env
  // file.
  accounts[0] = process.env.WALLET_KEY;

  const dai = network === 'mainnet'
    ? await IERC20.at(knownContracts.DAI[network])
    : await MockDai.deployed();

  const uniswapRouter = network === 'mainnet' || network === 'ropsten'
    ? await UniswapV2Router02.at(knownContracts.UniswapV2Router02[network])
    : await UniswapV2Router02.deployed();

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
    dai.address,
    ARTH.address,
    ARTHB.address,
    MahaToken.address,
    BondRedemtionOracle.address,
    MAHAUSDOracle.address,
    SeigniorageOracle.address,
    ArthLiquidityBoardroom.address,
    ArthBoardroom.address,
    DevelopmentFund.address,
    uniswapRouter.address,
    GMUOracle.address,
    POOL_START_DATE,
    TREASURY_PERIOD
  );
}


module.exports = migration;

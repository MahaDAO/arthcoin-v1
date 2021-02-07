const fs = require('fs');
const path = require('path');
const util = require('util');

const knownContracts = require('./known-contracts');

const writeFile = util.promisify(fs.writeFile);


// Deployment and ABI will be generated for contracts listed on here.
// The deployment thus can be used on frontend.
const exportedContracts = [
  'ARTH',
  'ARTHB',
  'MahaToken',

  // oracles
  'GMUOracle',
  'SeigniorageOracle',
  'ArthMahaOracle',
  'BondRedemtionOracle',

  // boardroom
  'ArthLiquidityBoardroom',
  'MahaLiquidityBoardroom',
  'ArthBoardroom',
  'Treasury',

  'DevelopmentFund',


  "ARTHBASPool",
  // "ARTHMKRPool",
  // "ARTHSHAREPool",
  // "ARTHCOMPool",
  // "ARTHESDPool",
  // "ARTHMahaEthLPPool",
  // "ARTHSUSHIPool",
  // "ARTHCURVEPool",
  // "ARTHFRAXPool",
  // "ARTHMahaPool",
  // "ARTHYFIPool",
  // "ARTHDSDPool",
  // "ARTHMATICPool",
  // "ARTHRSRPool",

  'MAHAARTHPool',
  'MAHADAIARTHLPTokenPool',
  'MAHAMAHAETHLPTokenPool'
  // ...distributionPoolContracts(),
];

const Arth = artifacts.require('ARTH');
const MahaToken = artifacts.require('MahaToken');
const SeigniorageOracle = artifacts.require('SeigniorageOracle');
const MockDai = artifacts.require('MockDai');
const IERC20 = artifacts.require('IERC20');
const UniswapV2Factory = artifacts.require('UniswapV2Factory');
const UniswapV2Router02 = artifacts.require('UniswapV2Router02');
const Multicall  = artifacts.require('Multicall');


/**
 * Main migrations
 */
module.exports = async (callback) => {
  const isMainnet = process.argv.includes('mainnet')
  const isDevelopment = process.argv.includes('development')

  // Set the main account, you'll be using accross all the files for various
  // important activities to your desired address in the .env file.
  // accounts[0] = process.env.WALLET_KEY;

  const deployments = {};


  try {
    const dai = !isDevelopment
      ? await IERC20.at(knownContracts.DAI[network])
      : await MockDai.deployed();

    const factory = !isDevelopment
      ? await UniswapV2Factory.at(knownContracts.UniswapV2Factory[network])
      : await UniswapV2Factory.deployed()

    const router = !isDevelopment
      ? await UniswapV2Router02.at(knownContracts.UniswapV2Router02[network])
      : await UniswapV2Router02.deployed()

    // deployments.DAI = {
    //   address: dai.address,
    //   abi: dai.abi,
    // };

    const oracle = await SeigniorageOracle.deployed();

    const arth = await Arth.deployed();
    const mahaToken = isMainnet
      ? await MahaToken.at(knownContracts.MahaToken[network])
      : await MahaToken.deployed();

    const dai_arth_lpt = await oracle.pairFor(factory.address, dai.address, arth.address)
    const maha_dai_lpt = await oracle.pairFor(factory.address, dai.address, mahaToken.address)

    console.log('dai at', dai.address);
    console.log('arth at', arth.address);
    console.log('maha at', mahaToken.address);
    console.log('uniswap factory at', factory.address);
    console.log('uniswap router at', router.address);
    console.log('dai_arth_lpt at', dai_arth_lpt);
    console.log('maha_dai_lpt at', maha_dai_lpt);

    if (isDevelopment) {
      const mutlicall = await Multicall.deployed()
      console.log('multicall at', mutlicall.address);
    }

    for (const name of exportedContracts) {
      const contract = artifacts.require(name);
      deployments[name] = {
        address: contract.address,
        abi: contract.abi,
      };
    }
    const deploymentPath = path.resolve(__dirname, `../build/deployments.${network}.json`);
    await writeFile(deploymentPath, JSON.stringify(deployments, null, 2));

    console.log(`Exported deployments into ${deploymentPath}`);


  } catch (error) {
    console.log(error)
  }
  callback();
};

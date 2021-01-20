const { FACTORY_ADDRESS, INIT_CODE_HASH } = require('@uniswap/sdk')
const { pack, keccak256 } = require('@ethersproject/solidity')
const { getCreate2Address } = require('@ethersproject/address')

const fs = require('fs');
const path = require('path');
const util = require('util');

const knownContracts = require('./known-contracts');

const writeFile = util.promisify(fs.writeFile);


// Deployment and ABI will be generated for contracts listed on here.
// The deployment thus can be used on frontend.
const exportedContracts = [
  // 'ARTH',
  // 'ARTHB',
  // 'MahaToken',

  // // oracles
  // 'GMUOracle',
  // 'SeigniorageOracle',
  // 'ArthMahaTestnetOracle',
  // 'BondRedemtionOracle',

  // boardroom
  // 'ArthLiquidityBoardroom',
  // 'ArthBoardroom',

  // 'DevelopmentFund',
  // 'Treasury',

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

  // 'MAHAARTHPool',
  // 'MAHADAIARTHLPTokenPool',
  // 'MAHAMAHAETHLPTokenPool'
  // ...distributionPoolContracts(),
];

const Arth = artifacts.require('ARTH');
const MahaToken = artifacts.require('MahaToken');
// const Oracle = artifacts.require('MockOracle');
const MockDai = artifacts.require('MockDai');
const IERC20 = artifacts.require('IERC20');

/**
 * Main migrations
 */
module.exports = async (callback) => {
  const network = 'development';

  // Set the main account, you'll be using accross all the files for various
  // important activities to your desired address in the .env file.
  // accounts[0] = process.env.WALLET_KEY;

  const deployments = {};


  try {
    const dai = network === 'mainnet'
      ? await IERC20.at(knownContracts.DAI[network])
      : await MockDai.deployed();

    // deployments.DAI = {
    //   address: dai.address,
    //   abi: dai.abi,
    // };

    const arth = await Arth.deployed();
    const mahaToken = network === 'mainnet'
      ? await MahaToken.at(knownContracts.MahaToken[network])
      : await MahaToken.deployed();

    // deployments.MahaToken = {
    //   address: mahaToken.address,
    //   abi: mahaToken.abi
    // }

    const dai_arth_lpt = getCreate2Address(
      FACTORY_ADDRESS,
      keccak256(['bytes'], [pack(['address', 'address'], [dai.address, arth.address])]),
      INIT_CODE_HASH
    )

    const maha_dai_lpt = getCreate2Address(
      FACTORY_ADDRESS,
      keccak256(['bytes'], [pack(['address', 'address'], [dai.address, mahaToken.address])]),
      INIT_CODE_HASH
    );

    console.log('dai at', dai.address);
    console.log('dai_arth_lpt at', dai_arth_lpt);
    console.log('maha_dai_lpt at', maha_dai_lpt);

    for (const name of exportedContracts) {
      const contract = artifacts.require(name);
      deployments[name] = {
        address: contract.address,
        // abi: contract.abi,
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

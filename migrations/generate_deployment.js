const fs = require('fs');
const path = require('path');
const util = require('util');

const knownContracts = require('./known-contracts');

const writeFile = util.promisify(fs.writeFile);
const mkdir = util.promisify(fs.mkdir);


// Deployment and ABI will be generated for contracts listed on here.
// The deployment thus can be used on frontend.
const exportedContracts = [
  'ARTH',
  'ARTHB',

  // oracles
  'GMUOracle',
  'SeigniorageOracle',
  'ArthMahaOracle',
  'BondRedemtionOracle',

  // boardroom
  'ArthUniLiquidityBoardroomV2',
  'ArthMlpLiquidityBoardroomV2',
  'MahaLiquidityBoardroomV2',
  'ArthBoardroomV2',

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
  const network = 'mainnet'
  const isMainnet = process.argv.includes('mainnet')
  const isDevelopment = process.argv.includes('development')

  // Set the main account, you'll be using accross all the files for various
  // important activities to your desired address in the .env file.
  // accounts[0] = process.env.WALLET_KEY;

  const contracts = [
    { abi: 'Treasury', contract: 'Treasury' },
    { abi: 'SimpleERCFund', contract: 'DevelopmentFund' },

    { abi: 'SimpleOracle', contract: 'GMUOracle' },
    { abi: 'UniswapOracle', contract: 'SeigniorageOracle' },
    { abi: 'UniswapOracle', contract: 'BondRedemtionOracle' },
    { abi: 'SimpleOracle', contract: 'ArthMahaOracle' },

    // boardroom stuff
    // { abi: 'VestedVaultBoardroom', contract: 'ArthArthBoardroomV2' },
    // { abi: 'VestedVaultBoardroom', contract: 'ArthArthMlpLiquidityBoardroomV2' },
    // { abi: 'VestedVaultBoardroom', contract: 'ArthMahaBoardroomV2' },
    // { abi: 'VestedVaultBoardroom', contract: 'MahaArthBoardroomV2' },
    // { abi: 'VestedVaultBoardroom', contract: 'MahaArthMlpLiquidityBoardroomV2' },
    // { abi: 'VestedVaultBoardroom', contract: 'MahaMahaBoardroomV2' },
    // { abi: 'Vault', contract: 'VaultArth' },
    // { abi: 'Vault', contract: 'VaultArthMlp' },
    // { abi: 'Vault', contract: 'VaultMaha' },
  ];



  // if (isMainnet) {
  //   contracts.push([
  //     { abi: 'SimpleBoardroom', contract: 'ArthUniLiquidityBoardroomV1' },
  //     { abi: 'SimpleBoardroom', contract: 'MahaLiquidityBoardroomV1' },
  //     { abi: 'SimpleBoardroom', contract: 'ArthBoardroomV1' }
  //   ]);
  // }

  const deployments = {};

  try {
    const mahaToken = isMainnet ?
      knownContracts.MahaToken[network] :
      (await MahaToken.deployed()).address;

    const dai = !isDevelopment ?
      knownContracts.DAI[network] :
      (await MockDai.deployed()).address;

    const factory = !isDevelopment ?
      knownContracts.UniswapV2Factory[network] :
      (await UniswapV2Factory.deployed()).address;

    const router = !isDevelopment ?
      knownContracts.UniswapV2Router02[network] :
      (await UniswapV2Router02.deployed()).address;

    const multicall = isMainnet ?
      knownContracts.Multicall[network] :
      (await Multicall.deployed()).address;

    contracts.push({ contract: 'UniswapV2Factory', address: factory, abi: 'UniswapV2Factory' });
    contracts.push({ contract: 'UniswapV2Router02', address: router, abi: 'UniswapV2Router02' });
    contracts.push({ contract: 'DAI', address: dai, abi: 'IERC20' });
    contracts.push({ contract: 'MahaToken', address: mahaToken, abi: 'MahaToken' });
    contracts.push({ contract: 'Multicall', address: multicall, abi: 'Multicall' });


    const abiDir = path.resolve(__dirname, `../output/abi`);
    const deploymentPath = path.resolve(__dirname, `../output/${network}.json`);

    await mkdir(abiDir, { recursive: true })

    for (const name of contracts) {
      const contractAddress = name.address ? name.address : artifacts.require(name.contract).address;
      const abiContract = artifacts.require(name.abi);

      deployments[name.contract] = {
        address: contractAddress,
        abi: name.abi,
      };

      const abiPath = path.resolve(abiDir, `${name.abi}.json`);
      await writeFile(abiPath, JSON.stringify(abiContract.abi, null, 2));
    }

    await writeFile(deploymentPath, JSON.stringify(deployments, null, 2));

    // const oracle = await SeigniorageOracle.deployed();

    // const arth = await Arth.deployed();
    // const mahaToken = isMainnet
    //   ? await MahaToken.at(knownContracts.MahaToken[network])
    //   : await MahaToken.deployed();

    // const dai_arth_lpt = await oracle.pairFor(factory.address, dai.address, arth.address)
    // const maha_dai_lpt = await oracle.pairFor(factory.address, dai.address, mahaToken.address)

    // console.log('dai at', dai.address);
    // console.log('arth at', arth.address);
    // console.log('maha at', mahaToken.address);
    // console.log('uniswap factory at', factory.address);
    // console.log('uniswap router at', router.address);
    // console.log('dai_arth_lpt at', dai_arth_lpt);
    // console.log('maha_dai_lpt at', maha_dai_lpt);
    // console.log('multicall at', multicall.address);

    // deployments.MahaToken = {
    //   address: mahaToken.address,
    //   abi: mahaToken.abi,
    // };

    // deployments.ArthDaiLP = {
    //   address: dai_arth_lpt
    // };

    // deployments.MahaEthLP = {
    //   address: maha_dai_lpt
    // };

    // if (network === 'development') {
    //   exportedContracts.push('ArthBoardroomV1', 'ArthLiquidityBoardroomV1', 'MahaLiquidityBoardroomV1')
    // }

    // for (const name of exportedContracts) {
    //   const contract = artifacts.require(name);
    //   deployments[name] = {
    //     address: contract.address,
    //     abi: contract.abi,
    //   };
    // }
    // const deploymentPath = path.resolve(__dirname, `../build/deployments.${network}.json`);
    // await writeFile(deploymentPath, JSON.stringify(deployments, null, 2));

    // console.log(`Exported deployments into ${deploymentPath}`);


  } catch (error) {
    console.log(error);
  }

  callback();
};

const fs = require('fs');
const path = require('path');
const util = require('util');
const { getDAI, getMahaToken, getUniswapFactory, getUniswapRouter } = require('./helpers');

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
  'TWAP12hrOracle',
  'ArthMahaOracle',
  'TWAP1hrOracle',

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


const Multicall  = artifacts.require('Multicall');


/**
 * Main migrations
 */
module.exports = async (callback) => {
  const network = process.argv[5];
  const isMainnet = process.argv.includes('mainnet');

  // Set the main account, you'll be using accross all the files for various
  // important activities to your desired address in the .env file.
  // accounts[0] = process.env.WALLET_KEY;

  const contracts = [
    { abi: 'Treasury', contract: 'Treasury' },
    { abi: 'Maharaja', contract: 'Maharaja' },
    { abi: 'SimpleERCFund', contract: 'DevelopmentFund' },
    { abi: 'SimpleERCFund', contract: 'RainyDayFund' },

    { abi: 'BaseToken', contract: 'ARTHB' },
    { abi: 'BaseToken', contract: 'ARTH' },

    { abi: 'SimpleOracle', contract: 'GMUOracle' },
    { abi: 'UniswapOracle', contract: 'TWAP12hrOracle' },
    { abi: 'UniswapOracle', contract: 'TWAP1hrOracle' },

    // boardroom stuff
    { abi: 'VestedVaultBoardroom', contract: 'ArthArthBoardroomV2' },
    { abi: 'VestedVaultBoardroom', contract: 'ArthArthMlpLiquidityBoardroomV2' },
    { abi: 'VestedVaultBoardroom', contract: 'ArthMahaBoardroomV2' },
    { abi: 'VestedVaultBoardroom', contract: 'MahaArthBoardroomV2' },
    { abi: 'VestedVaultBoardroom', contract: 'MahaArthMlpLiquidityBoardroomV2' },
    { abi: 'VestedVaultBoardroom', contract: 'MahaMahaBoardroomV2' },
    { abi: 'Vault', contract: 'VaultArth' },
    { abi: 'Vault', contract: 'VaultArthMlp' },
    { abi: 'Vault', contract: 'VaultMaha' },
  ];

  const deployments = {};

  try {
    const mahaToken = (await getMahaToken(network, null, artifacts)).address;
    const dai = (await getDAI(network, null, artifacts)).address;
    const cash = (await artifacts.require('ARTH')).address;
    const factory = (await getUniswapFactory(network, null, artifacts));
    const router = (await getUniswapRouter(network, null, artifacts)).address;

    const multicall = knownContracts.Multicall[network] ?
      knownContracts.Multicall[network] :
      (await Multicall.deployed()).address;

    const arthDaiLP = knownContracts.ARTH_DAI_LP[network] ?
      knownContracts.ARTH_DAI_LP[network] :
      (await factory.getPair(cash, dai));

    const mahaEthLP = knownContracts.MAHA_ETH_LP[network] ?
      knownContracts.MAHA_ETH_LP[network] :
      (await factory.getPair(mahaToken, dai));

    contracts.push({ contract: 'UniswapV2Factory', address: factory.address, abi: 'UniswapV2Factory' });
    contracts.push({ contract: 'UniswapV2Router02', address: router, abi: 'UniswapV2Router02' });
    contracts.push({ contract: 'DAI', address: dai, abi: 'IERC20' });
    contracts.push({ contract: 'MahaToken', address: mahaToken, abi: 'MahaToken' });
    contracts.push({ contract: 'Multicall', address: multicall, abi: 'Multicall' });

    // add LP tokens
    contracts.push({ contract: 'ArthDaiLP', address: arthDaiLP, abi: 'IUniswapV2Pair' });
    contracts.push({ contract: 'MahaEthLP', address: mahaEthLP, abi: 'IUniswapV2Pair' });

    const abiDir = path.resolve(__dirname, `../output/abi`);
    const deploymentPath = path.resolve(__dirname, `../output/${network}.json`);

    await mkdir(abiDir, { recursive: true });

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
  } catch (error) {
    console.log(error);
  }

  callback();
};

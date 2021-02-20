const { getDAI, getMahaToken, isMainnet, getPairAddress } = require('./helpers');
const knownContracts = require('./known-contracts');


const ARTH = artifacts.require('ARTH');
const ArthArthBoardroomV2 = artifacts.require('ArthArthBoardroomV2');
const ArthArthMlpLiquidityBoardroomV2 = artifacts.require('ArthArthMlpLiquidityBoardroomV2')
const ArthBoardroom = artifacts.require('ArthBoardroomV1');
const ArthLiquidityBoardroom = artifacts.require('ArthLiquidityBoardroomV1');
const ArthMahaBoardroomV2 = artifacts.require('ArthMahaBoardroomV2');
const MahaArthBoardroomV2 = artifacts.require('MahaArthBoardroomV2');
const MahaArthMlpLiquidityBoardroomV2 = artifacts.require('MahaArthMlpLiquidityBoardroomV2');
const MahaLiquidityBoardroom = artifacts.require('MahaLiquidityBoardroomV1');
const MahaMahaBoardroomV2 = artifacts.require('MahaMahaBoardroomV2');
const VaultArth = artifacts.require('VaultArth');
const VaultArthMlp = artifacts.require('VaultArthMlp');
const VaultMaha = artifacts.require('VaultMaha');


async function migration(deployer, network, accounts) {
  // Set the main account, you'll be using accross all the files for
  // various important activities to your desired address in the .env
  // file.
  accounts[0] = process.env.WALLET_KEY;

  const DAY = 86400;
  const HOUR = 3600;

  const REWARDS_VESTING = network === 'mainnet' ? 8 * HOUR : HOUR;
  const TOKEN_LOCK_DURATION = network === 'mainnet' ? 5 * DAY : 60 * 5;
  const LIQUIDITY_LOCK_DURATION = network === 'mainnet' ? 1 * DAY : 60 * 5;

  // Deploy dai or fetch deployed dai.
  const dai = await getDAI(network, deployer, artifacts);
  const cash = await ARTH.deployed();
  const share = await getMahaToken(network, deployer, artifacts);

  // Get the oracle pair of ARTH-DAI.
  const dai_arth_lpt = network === 'mainnet' ?
    knownContracts.ARTH_DAI_LP[network] :
    await getPairAddress(cash.address, dai.address, network, deployer, artifacts);

  // Deploy ARTH-DAI liquidity boardroom.
  await deployer.deploy(VaultArth, cash.address, TOKEN_LOCK_DURATION);
  await deployer.deploy(VaultMaha, share.address, TOKEN_LOCK_DURATION);
  await deployer.deploy(VaultArthMlp, dai_arth_lpt, LIQUIDITY_LOCK_DURATION);

  const arthVault = await VaultArth.deployed();
  const mahaVault = await VaultMaha.deployed();
  const arthLpVault = await VaultArthMlp.deployed();

  await deployer.deploy(ArthArthBoardroomV2, cash.address, arthVault.address, REWARDS_VESTING);
  await deployer.deploy(ArthMahaBoardroomV2, cash.address, mahaVault.address, REWARDS_VESTING);
  await deployer.deploy(ArthArthMlpLiquidityBoardroomV2, cash.address, arthLpVault.address, REWARDS_VESTING);

  await deployer.deploy(MahaArthBoardroomV2, share.address, arthVault.address, REWARDS_VESTING);
  await deployer.deploy(MahaMahaBoardroomV2, share.address, mahaVault.address, REWARDS_VESTING);
  await deployer.deploy(MahaArthMlpLiquidityBoardroomV2, share.address, arthLpVault.address, REWARDS_VESTING);

  // if (!isMainnet(network)) {
  //   // Deploy ARTH-DAI liquidity boardroom.
  //   await deployer.deploy(ArthLiquidityBoardroom, cash.address, dai_arth_lpt, LIQUIDITY_LOCK_DURATION);

  //   // Deploy arth boardroom.
  //   await deployer.deploy(ArthBoardroom, cash.address, TOKEN_LOCK_DURATION);

  //   // Deploy MAHA-ETH boardroom.
  //   await deployer.deploy(MahaLiquidityBoardroom, cash.address, maha_weth_lpt, LIQUIDITY_LOCK_DURATION);
  // }
}


module.exports = migration;

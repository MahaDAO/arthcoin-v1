const { KNOWN_CONTRACTS } = require('./config');


const ARTH = artifacts.require('ARTH');
const ARTHB = artifacts.require('ARTHB');
const MahaToken = artifacts.require('MahaToken');
const MockDai = artifacts.require('MockDai');


async function migration(deployer, network, accounts) {
  // Set the main account, you'll be using accross all the files for
  // various important activities to your desired address in the .env
  // file.
  accounts[0] = process.env.WALLET_KEY;

  // Deploy or fetch deployed dai.
  console.log(`Fetching dai on ${network} network.`);
  const dai = network === 'mainnet'
    ? await IERC20.at(KNOWN_CONTRACTS.DAI[network])
    : await MockDai.deployed();

  // Fetch deployed tokens.
  const cash = await ARTH.deployed();
  const mahaToken = await MahaToken.deployed();
  const bond = await ARTHB.deployed();

  if (network !== 'mainnet') {
    // Mint 10 maha tokens to self if not on mainnet.
    console.log('Minting MAHA tokens.')
    await mahaToken.mint(accounts[0], web3.utils.toBN(10 ** 18).toString());

    // Mint some tokens to the metamask wallet holder in dev.
    if (process.env.METAMASK_WALLET) {
      console.log('sending some dummy tokens; 100k')
      await cash.mint(process.env.METAMASK_WALLET, web3.utils.toBN(10 * 10 ** 18).toString());
      await mahaToken.mint(process.env.METAMASK_WALLET, web3.utils.toBN(10 * 10 ** 18).toString());
      await dai.transfer(process.env.METAMASK_WALLET, web3.utils.toBN(10 * 10 ** 18).toString());
    }
  }

  console.log('\nChecking balance of all tokens.');
  console.log(' - Dai account balance:', (await dai.balanceOf(accounts[0])).toString())
  console.log(' - ARTH account balance:', (await cash.balanceOf(accounts[0])).toString())
  console.log(' - MAHA account balance:', (await mahaToken.balanceOf(accounts[0])).toString())
  console.log(' - ARTHB account balance:', (await bond.balanceOf(accounts[0])).toString())
}


module.exports = migration;

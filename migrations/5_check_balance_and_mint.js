const { BigNumber } = require('ethers');
const { getDAI, getMahaToken, isMainnet } = require('./helpers');
const ARTH = artifacts.require('ARTH');


async function migration(deployer, network, accounts) {
  // Set the main account, you'll be using accross all the files for
  // various important activities to your desired address in the .env
  // file.
  accounts[0] = process.env.WALLET_KEY;

  // Deploy or fetch deployed dai.

  // Fetch deployed tokens.
  const dai = await getDAI(network, deployer, artifacts);
  const cash = await ARTH.deployed();
  const mahaToken = await getMahaToken(network, deployer, artifacts);

  if (!isMainnet(network)) {
    const mil = BigNumber.from(10).pow(24);

    // Mint 1mn maha tokens to self if not on mainnet.
    console.log('Minting 1mil MAHA tokens.')
    await mahaToken.mint(accounts[0], mil);

    console.log('Minting ARTH tokens.')
    await cash.mint(accounts[0], mil);

    // Mint some tokens to the metamask wallet holder in dev.
    if (process.env.METAMASK_WALLET) {
      console.log('sending some dummy tokens; 100k')
      await cash.mint(process.env.METAMASK_WALLET, mil);
      await mahaToken.mint(process.env.METAMASK_WALLET, mil);
      await dai.transfer(process.env.METAMASK_WALLET, mil);
    }
  }

  console.log('\nChecking balance of all tokens.');
  console.log(' - Dai account balance:', (await dai.balanceOf(accounts[0])).toString());
  console.log(' - ARTH account balance:', (await cash.balanceOf(accounts[0])).toString());
  console.log(' - MAHA account balance:', (await mahaToken.balanceOf(accounts[0])).toString());
}


module.exports = migration;

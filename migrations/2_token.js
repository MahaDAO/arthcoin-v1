/**
 * Contracts.
 */
const Cash = artifacts.require('Cash')
const Bond = artifacts.require('Bond')
const MahaToken = artifacts.require('MahaToken')
const MockDai = artifacts.require('MockDai');


/**
 * Deploy
 */
async function deployToken(deployer, network, accounts) {
  // Set the main account, you'll be using accross all the files for various
  // important activities to your desired address in the .env file.
  accounts[0] = process.env.WALLET_KEY;

  await deployer.deploy(Cash);
  await deployer.deploy(Bond);
  await deployer.deploy(MahaToken);

  if (network !== 'mainnet') {
    // await deployer.deploy(MahaToken);
    const dai = await deployer.deploy(MockDai);
    console.log(`MockDAI address: ${dai.address}`);
  }
}


/**
 * Main migrations
 */
const migration = async (deployer, network, accounts) => {
  await Promise.all([deployToken(deployer, network, accounts)])
}


module.exports = migration;
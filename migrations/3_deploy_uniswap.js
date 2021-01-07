const UniswapV2Factory = artifacts.require('UniswapV2Factory');
const UniswapV2Router02 = artifacts.require('UniswapV2Router02');


async function migration(deployer, network, accounts) {
  // Set the main account, you'll be using accross all the files for
  // various important activities to your desired address in the .env
  // file.
  accounts[0] = process.env.WALLET_KEY;

  // Deploy uniswap.
  if (network !== 'mainnet' && network !== 'ropsten') {
    console.log(`Deploying uniswap on ${network} network.`, accounts[0]);
    const uniswap = await deployer.deploy(UniswapV2Factory, accounts[0]);

    await deployer.deploy(UniswapV2Router02, UniswapV2Factory.address, accounts[0]);
  }
}


module.exports = migration;
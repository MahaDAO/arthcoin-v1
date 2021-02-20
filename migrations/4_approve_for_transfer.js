const { getDAI, getUniswapRouter, approveIfNot } = require('./helpers');

const ARTH = artifacts.require('ARTH');


async function migration(deployer, network, accounts) {
  // Set the main account, you'll be using accross all the files for
  // various important activities to your desired address in the .env
  // file.
  accounts[0] = process.env.WALLET_KEY;

  const dai = await getDAI(network, deployer, artifacts);
  const cash = await ARTH.deployed();
  const uniswapRouter = await getUniswapRouter(network, deployer, artifacts)

  const mil = web3.utils.toBN(10 ** 7);
  const max = web3.utils.toBN(10 ** 18).mul(mil).toString();

  await Promise.all([
    approveIfNot(cash, uniswapRouter.address, max),
    approveIfNot(dai, uniswapRouter.address, max)
  ]);
}


module.exports = migration;

const knownContracts = require('./known-contracts');


const ARTH = artifacts.require('ARTH');
const ARTHB = artifacts.require('ARTHB');
const MockDai = artifacts.require('MockDai');
const MahaToken = artifacts.require('MahaToken');
const UniswapV2Router02 = artifacts.require('UniswapV2Router02');


async function approveIfNot(token, owner, spender, amount) {
  const allowance = await token.allowance(owner, spender);

  if (web3.utils.toBN(allowance).gte(web3.utils.toBN(amount))) {
    return;
  }

  await token.approve(spender, amount);
  console.log(` - Approved ${token.symbol ? (await token.symbol()) : token.address}`);
}


async function migration(deployer, network, accounts) {
  // Set the main account, you'll be using accross all the files for
  // various important activities to your desired address in the .env
  // file.
  accounts[0] = process.env.WALLET_KEY;

  // Deploy or fetch deployed dai.
  console.log(`Fetching dai on ${network} network.`);
  const dai = network === 'mainnet'
    ? await IERC20.at(knownContracts.DAI[network])
    : await MockDai.deployed();

  // Fetch deployed tokens.
  const cash = await ARTH.deployed();
  const mahaToken = await MahaToken.deployed();
  const bond = await ARTHB.deployed();

  // Fetch deployed uniswap router.
  const uniswapRouter = network === 'mainnet' || network === 'ropsten'
    ? await UniswapV2Router02.at(knownContracts.UniswapV2Router02[network])
    : await UniswapV2Router02.deployed();

  console.log('Approving Uniswap on tokens for liquidity');
  const max = web3.utils.toBN(10 ** 18).muln(10000).toString();

  await Promise.all([
    approveIfNot(cash, accounts[0], uniswapRouter.address, max),
    approveIfNot(mahaToken, accounts[0], uniswapRouter.address, max),
    approveIfNot(dai, accounts[0], uniswapRouter.address, max),
  ]);
}


module.exports = migration;

const knownContracts = require('./known-contracts');


const ARTH = artifacts.require('ARTH');
const ARTHB = artifacts.require('ARTHB');
const MockDai = artifacts.require('MockDai');
const MahaToken = artifacts.require('MahaToken');
const MockDai = artifacts.require('MockDai');
const UniswapV2Router02 = artifacts.require('UniswapV2Router02');


function deadline() {
  // Create a timestamp of 30 minutes past current time.
  return Math.floor(new Date().getTime() / 1000) + 1800;
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

  // Fetch the deployed ARTH token.
  const cash = await ARTH.deployed();
  const share = await MahaToken.deployed();
  const bond = await ARTHB.deployed();

  // Fetch deployed uniswap router.
  const uniswapRouter = network === 'mainnet' || network === 'ropsten'
    ? await UniswapV2Router02.at(knownContracts.UniswapV2Router02[network])
    : await UniswapV2Router02.deployed();

  // WARNING: msg.sender must hold enough DAI to add liquidity to the ARTH-DAI
  // pool otherwise transaction will revert.
  console.log('\nAdding liquidity to ARTH-DAI pool');

  const unit = web3.utils.toBN(10 ** 18).toString();
  await uniswapRouter.addLiquidity(
    cash.address,
    dai.address,
    unit,
    unit,
    unit,
    unit,
    accounts[0],
    deadline()
  )

  if (network !== 'mainnet') {
    // depoly MAHA-DAI and ARTHB-DAI pools as well
    const hundredK = web3.utils.toBN(100000 * 1e18).toString();
    await uniswapRouter.addLiquidity(
      cash.address,
      dai.address,
      hundredK,
      hundredK,
      hundredK,
      hundredK,
      accounts[0],
      deadline()
    )

    await uniswapRouter.addLiquidity(
      share.address,
      dai.address,
      hundredK,
      hundredK,
      hundredK,
      hundredK,
      accounts[0],
      deadline()
    )

    await uniswapRouter.addLiquidity(
      bond.address,
      dai.address,
      hundredK,
      hundredK,
      hundredK,
      hundredK,
      accounts[0],
      deadline()
    )
  }
}


module.exports = migration;

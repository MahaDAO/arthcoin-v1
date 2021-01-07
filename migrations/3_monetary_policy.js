const ARTH = artifacts.require('ARTH');
const ARTHB = artifacts.require('ARTHB');
const MahaToken = artifacts.require('MahaToken');
const IERC20 = artifacts.require('IERC20');
const MockDai = artifacts.require('MockDai');
const DevelopmentFund = artifacts.require('DevelopmentFund');
const BurnbackFund = artifacts.require('BurnbackFund');
const BondRedemtionOracle = artifacts.require('BondRedemtionOracle');
const Treasury = artifacts.require('Treasury');
const ArthLiquidityBoardroom = artifacts.require('ArthLiquidityBoardroom');
const ArthBoardroom = artifacts.require('ArthBoardroom');
const GMUOracle = artifacts.require('GMUOracle');
const MAHAUSDOracle = artifacts.require('MAHAUSDOracle');
const SeigniorageOracle = artifacts.require('SeigniorageOracle');

const UniswapV2Factory = artifacts.require('UniswapV2Factory');
const UniswapV2Router02 = artifacts.require('UniswapV2Router02');

const { POOL_START_DATE } = require('./pools');
const knownContracts = require('./known-contracts');


const DAY = 86400;
const HOUR = 60 * 60;


async function approveIfNot(token, owner, spender, amount) {
  const allowance = await token.allowance(owner, spender);

  if (web3.utils.toBN(allowance).gte(web3.utils.toBN(amount))) {
    return;
  }

  await token.approve(spender, amount);
  console.log(` - Approved ${token.symbol ? (await token.symbol()) : token.address}`);
}


function deadline() {
  // 30 minutes.
  return Math.floor(new Date().getTime() / 1000) + 1800;
}


async function migration(deployer, network, accounts) {
  // Set the main account, you'll be using accross all the files for
  // various important activities to your desired address in the .env
  // file.
  accounts[0] = process.env.WALLET_KEY;

  let uniswap, uniswapRouter;

  // Deploy uniswap.
  if (network !== 'mainnet' && network !== 'ropsten') {
    console.log(`Deploying uniswap on ${network} network.`, accounts[0]);
    await deployer.deploy(UniswapV2Factory, accounts[0]);
    uniswap = await UniswapV2Factory.deployed();

    await deployer.deploy(UniswapV2Router02, uniswap.address, accounts[0]);
    uniswapRouter = await UniswapV2Router02.deployed();
  } else {
    uniswap = await UniswapV2Factory.at(knownContracts.UniswapV2Factory[network]);
    uniswapRouter = await UniswapV2Router02.at(knownContracts.UniswapV2Router02[network]);
  }

  // Deploy dai.
  console.log(`Fetching dai on ${network} network.`);

  const dai = network === 'mainnet'
    ? await IERC20.at(knownContracts.DAI[network])
    : await MockDai.deployed();

  // Provide liquidity to BAC-DAI and BAS-DAI pair if you don't provide 
  // liquidity to BAC-DAI and BAS-DAI pair after step 1 and before step 
  // 3, creating Oracle will fail with NO_RESERVES error.
  const unit = web3.utils.toBN(10 ** 18).toString();
  const max = web3.utils.toBN(10 ** 18).muln(10000).toString();

  const cash = await ARTH.deployed();
  const mahaToken = await MahaToken.deployed();
  const bond = await ARTHB.deployed();

  console.log('Approving Uniswap on tokens for liquidity');
  await Promise.all([
    approveIfNot(cash, accounts[0], uniswapRouter.address, max),
    approveIfNot(mahaToken, accounts[0], uniswapRouter.address, max),
    approveIfNot(dai, accounts[0], uniswapRouter.address, max),
  ]);

  if (network !== 'mainnet') {
    // Mint 10 maha tokens to self if not on mainnet.
    await mahaToken.mint(accounts[0], web3.utils.toBN(2 * 10 * 1e18).toString());
  }

  console.log('\nBalance check');
  console.log(' - Dai account balance:', (await dai.balanceOf(accounts[0])).toString())
  console.log(' - ARTH account balance:', (await cash.balanceOf(accounts[0])).toString())
  console.log(' - MAHA account balance:', (await mahaToken.balanceOf(accounts[0])).toString())
  console.log(' - ARTHB account balance:', (await bond.balanceOf(accounts[0])).toString())

  // WARNING: msg.sender must hold enough DAI to add liquidity to BAC-DAI & BAS-DAI
  // pools otherwise transaction will revert.
  console.log('\nAdding liquidity to pools');
  await uniswapRouter.addLiquidity(
    cash.address,
    dai.address,
    unit,
    unit,
    unit,
    unit,
    accounts[0],
    deadline(),
  );

  // Deploy arth boardroom.
  // TODO: Replace cash with bonded arth token.
  await deployer.deploy(ArthLiquidityBoardroom, cash.address, cash.address);

  // Deploy arth liquidity boardroom.
  // TODO: Replace cash with arth liqduity token.
  await deployer.deploy(ArthBoardroom, cash.address);

  // Deploy funds.
  console.log('deploying funds')
  await deployer.deploy(DevelopmentFund);
  await deployer.deploy(BurnbackFund);

  const startTime = POOL_START_DATE;
  if (network === 'mainnet') {
    startTime += 5 * DAY;
  }

  // Deploy oracle for the pair between ARTH and dai.
  console.log('deploying bond oracle')
  const bondRedemtionOralce = await deployer.deploy(
    BondRedemtionOracle,
    uniswap.address,
    cash.address, // NOTE YA: I guess bond oracle is for dai - cash pool.
    dai.address,
    2 * HOUR, // In hours for dev deployment purpose.
    startTime
  );

  // Deploy seigniorage oracle.
  console.log('deploying seigniorage oracle')
  const seigniorageOracle = await deployer.deploy(
    SeigniorageOracle,
    uniswap.address,
    cash.address,
    dai.address,
    2 * HOUR, // In hours for dev deployment purpose.
    startTime
  );

  // Deploy boardrooms.
  const dai_arth_lpt = await bondRedemtionOralce.pairFor(uniswap.address, cash.address, dai.address);
  const arthLiquidityBoardroom = await deployer.deploy(ArthLiquidityBoardroom, cash.address, dai_arth_lpt);
  const arthBoardroom = await deployer.deploy(ArthBoardroom, cash.address);

  // Deploy the GMU oracle.
  console.log('deploying GMU oracle')
  const gmuOrale = await deployer.deploy(GMUOracle, 'GMU');
  await gmuOrale.setPrice(web3.utils.toBN(1e18).toString()); // set starting price to be 1$

  // Deploy MAHA-USD oracle.
  console.log('Deploying MAHA-USD oracle')
  const mahausdOracle = await deployer.deploy(MAHAUSDOracle, 'MAHA-USD');
  await mahausdOracle.setPrice(web3.utils.toBN(1e18).toString()); // set starting price to be 1$

  console.log('deploying treasurey')
  const treasurey = await deployer.deploy(
    Treasury,
    cash.address,
    ARTHB.address,
    MahaToken.address,
    BondRedemtionOracle.address,
    MAHAUSDOracle.address,
    SeigniorageOracle.address,
    ArthLiquidityBoardroom.address,
    ArthBoardroom.address,
    DevelopmentFund.address,
    BurnbackFund.address,
    GMUOracle.address,
    startTime,
  );

  // TODO: yash; pass this within the constructor itself
  console.log('setting timestamp properly')
  if (network !== 'mainnet') {
    await treasurey.setPeriod(10 * 60) // 10 min epoch for development purposes
    // await mahausdOracle.setPeriod(5 * 60) // 5 min epoch
    await bondRedemtionOralce.setPeriod(5 * 60) // 5 min epoch
    await seigniorageOracle.setPeriod(5 * 60) // 5 min epoch
    await arthLiquidityBoardroom.changeLockDuration(5 * 60) // 5 min for liquidity staking locks
    await arthBoardroom.changeLockDuration(5 * 60) // 5 min for staking locks

    // mint some tokens to the metamask wallet holder in dev
    if (process.env.METAMASK_WALLET) {
      console.log('sending some dummy tokens; 100k')
      await cash.mint(process.env.METAMASK_WALLET, web3.utils.toBN(10e18).toString());
      await mahaToken.mint(process.env.METAMASK_WALLET, web3.utils.toBN(10e18).toString());
      await dai.transfer(process.env.METAMASK_WALLET, web3.utils.toBN(10e18).toString());
    }
  } else {
    await treasurey.setPeriod(6 * 60 * 60) // start with a 6 hour epoch
    await arthLiquidityBoardroom.changeLockDuration(86400) // 1 day for staking locks
    await arthBoardroom.changeLockDuration(5 * 86400) // 5 days for staking locks
  }
}


module.exports = migration;
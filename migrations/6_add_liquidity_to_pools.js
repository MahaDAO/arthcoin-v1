const { approveIfNot, getUniswapRouter, getDAI, getMahaToken } = require('./helpers');
const ARTH = artifacts.require('ARTH');


function deadline() {
  // Create a timestamp of 30 minutes past current time.
  return Math.floor(new Date().getTime() / 1000) + 1800;
}


async function migration(deployer, network, accounts) {
  // Set the main account, you'll be using accross all the files for
  // various important activities to your desired address in the .env
  // file.
  accounts[0] = process.env.WALLET_KEY;

  const dai = await getDAI(network, deployer, artifacts);
  const cash = await ARTH.deployed();
  const uniswapRouter = await getUniswapRouter(network, deployer, artifacts);

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
  );

  if (network !== 'mainnet') {
    const share = await getMahaToken(network, deployer, artifacts);

    console.log('Minting some more tokens for dev', accounts[0]);

    console.log('\nAdding liquidity to ARTH-DAI pool');
    const hundredKBn = web3.utils.toBN(10 ** 5);
    const hundredK = web3.utils.toBN(10 ** 18).mul(hundredKBn).toString();
    await uniswapRouter.addLiquidity(
      cash.address,
      dai.address,
      hundredK,
      hundredK,
      hundredK,
      hundredK,
      accounts[0],
      deadline()
    );

    console.log('\nAdding liquidity to MAHA-DAI pool');

    await approveIfNot(share, uniswapRouter.address, hundredK)

    await uniswapRouter.addLiquidity(
      share.address,
      dai.address,
      hundredK,
      hundredK,
      hundredK,
      hundredK,
      accounts[0],
      deadline()
    );
  }
}


module.exports = migration;

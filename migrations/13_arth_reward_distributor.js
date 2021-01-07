const ARTH = artifacts.require('ARTH')
const InitialCashDistributor = artifacts.require('InitialCashDistributor');

const { arthPools, INITIAL_ARTH_FOR_POOLS } = require('./pools');


/**
 * Main migrations
 */
module.exports = async (deployer, network, accounts) => {
  return
  // Set the main account, you'll be using accross all the files for various
  // important activities to your desired address in the .env file.
  accounts[0] = process.env.WALLET_KEY;

  const unit = web3.utils.toBN(10 ** 18);
  const initialCashAmount = unit.muln(INITIAL_ARTH_FOR_POOLS).toString();

  const cash = await ARTH.deployed();
  const pools = arthPools.map(({ contractName }) => artifacts.require(contractName));

  await deployer.deploy(
    InitialCashDistributor,
    cash.address,
    pools.map(p => p.address),
    initialCashAmount,
  );
  const distributor = await InitialCashDistributor.deployed();

  console.log(`Setting distributor to InitialCashDistributor (${distributor.address})`);
  for await (const poolInfo of pools) {
    const pool = await poolInfo.deployed()
    await pool.setRewardDistribution(distributor.address);
  }

  await cash.mint(distributor.address, initialCashAmount);
  console.log(`Deposited ${INITIAL_ARTH_FOR_POOLS} ARTH to InitialCashDistributor.`);

  await distributor.distribute();
}

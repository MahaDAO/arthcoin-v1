const { bacPools, INITIAL_BAC_FOR_POOLS } = require('./pools');

// Pools
// deployed first
const Cash = artifacts.require('Arth')
const InitialCashDistributor = artifacts.require('InitialCashDistributor');

// ============ Main Migration ============

module.exports = async (deployer, network, accounts) => {
  const unit = web3.utils.toBN(10 ** 18);
  const initialCashAmount = unit.muln(150000).toString();

  const cash = await Cash.deployed();

  const filteredPools = bacPools
  // exclude maha pools (as they get different amount of ARTH rewards)
  .filter(({ contractName }) => contractName.indexOf('ARTHMaha') === -1)

  console.log('commuinty pools are', filteredPools.map(d => d.contractName).join(', '))

  const pools = filteredPools.map(({contractName}) => artifacts.require(contractName));

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
  console.log(`Deposited 150k ARTH to InitialCashDistributor. You'll need to manually distribute the remaining 350k`);

  await distributor.distribute();
  console.log(`Deposited ARTH to all community pools.`);
}

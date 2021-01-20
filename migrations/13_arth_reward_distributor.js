const { bacPools, INITIAL_BAC_FOR_POOLS } = require('./pools');
const { BigNumber } = require('ethers');

// Pools
// deployed first
const Cash = artifacts.require('ARTH')
const InitialCashDistributor = artifacts.require('InitialCashDistributor');
const ARTHMahaPool = artifacts.require('ARTHMahaPool');
const ARTHMahaEthLPPool = artifacts.require('ARTHMahaEthLPPool');

// ============ Main Migration ============

module.exports = async (deployer, network, accounts) => {
  const unit = web3.utils.toBN(10 ** 18);
  const initialCashAmount = unit.muln(150000).toString();

  const cash = await Cash.deployed();

  const filteredPools = bacPools
    // exclude maha pools (as they get different amount of ARTH rewards)
    .filter(({ contractName }) => contractName.indexOf('ARTHMaha') === -1)

  console.log('commuinty pools are', filteredPools.map(d => d.contractName).join(', '))

  const pools = filteredPools.map(({ contractName }) => artifacts.require(contractName));

  await deployer.deploy(
    InitialCashDistributor,
    cash.address,
    pools.map(p => p.address),
    initialCashAmount,
  );
  const distributor = await InitialCashDistributor.deployed();

  console.log(`Setting distributor to InitialCashDistributor (${distributor.address})`);
  for await (const poolInfo of pools) {
    console.log('done for ', poolInfo)
    const pool = await poolInfo.deployed()
    await pool.setRewardDistribution(distributor.address);
  }

  await cash.mint(distributor.address, initialCashAmount);
  console.log(`Deposited 150k ARTH to InitialCashDistributor. You'll need to manually distribute the remaining 350k`);


  if (network === 'mainnet') {
    const decimals = BigNumber.from(10).pow(18)
    cash.mint(ARTHMahaPool.address, BigNumber.from(150000).mul(decimals))
    cash.mint(ARTHMahaEthLPPool.address, BigNumber.from(150000).mul(decimals))

    console.log(`Deposited ARTH to all community pools.`);
  }

  await distributor.distribute();


  if (network === 'development') {
    console.log('sending 1 eth to the metamask wallet')
    const amountToSend = web3.utils.toWei("1", "ether"); // Convert to wei value
    web3.eth.sendTransaction({ from: accounts[0], to: process.env.METAMASK_WALLET, value: String(amountToSend) });
  }
}

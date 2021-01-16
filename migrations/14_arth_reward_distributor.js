const { bacPools, INITIAL_BAC_FOR_POOLS } = require('./pools');
const { BigNumber } = require('ethers');
const { POOL_START_DATE } = require('./pools');

// Pools
// deployed first
const Cash = artifacts.require('Arth')
const InitialCashDistributor = artifacts.require('InitialCashDistributor');
const ARTHMahaPool = artifacts.require('ARTHMahaPool');
const MAHADAIARTHLPTokenPool = artifacts.require('MAHADAIARTHLPTokenPool')

// ============ Main Migration ============

module.exports = async () => {
  await deployer.deploy(MAHADAIARTHLPTokenPool, '0xb4d930279552397bba2ee473229f89ec245bc365', '0x35b6f9e6300aa6c722ea189e096b0b073025806f', POOL_START_DATE);
}

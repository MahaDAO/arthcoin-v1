const InitialCashDistributor = artifacts.require('InitialCashDistributor');
const InitialShareDistributor = artifacts.require('InitialShareDistributor');

module.exports = async (deployer, network, accounts) => {
  const cashDist = await InitialCashDistributor.deployed()
  const maahaDist = await InitialShareDistributor.deployed()

  await cashDist.distribute();
  await maahaDist.distribute();

  console.log(`Distributor manager contract is ${distributor.address}`)
}

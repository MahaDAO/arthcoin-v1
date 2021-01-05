const Distributor = artifacts.require('Distributor');
const InitialCashDistributor = artifacts.require('InitialCashDistributor');


/**
 * Main migrations
 */
module.exports = async (deployer, network, accounts) => {
  // Set the main account, you'll be using accross all the files for various
  // important activities to your desired address in the .env file.
  accounts[0] = process.env.WALLET_KEY;

  const distributors = await Promise.all(
    [
      InitialCashDistributor,
      // InitialShareDistributor,
    ].map(distributor => distributor.deployed())
  );

  await deployer.deploy(
    Distributor,
    distributors.map(contract => contract.address),
  );
  const distributor = await Distributor.deployed();

  console.log(`Distributor manager contract is ${distributor.address}`)
}
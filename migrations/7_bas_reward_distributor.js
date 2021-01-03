const {
  basPools,
  INITIAL_BAS_FOR_DAI_BAC,
  INITIAL_BAS_FOR_DAI_BAS,
} = require('./pools');

const MahaToken = artifacts.require('MahaToken');
const InitialShareDistributor = artifacts.require('InitialShareDistributor');


/**
 * Main migrations
 */
async function migration(deployer, network, accounts) {
  // Set the main account, you'll be using accross all the files for various
  // important activities to your desired address in the .env file.
  accounts[0] = process.env.WALLET_KEY;

  const unit = web3.utils.toBN(10 ** 18);
  const totalBalanceForDAIBAC = unit.muln(INITIAL_BAS_FOR_DAI_BAC)
  const totalBalanceForDAIBAS = unit.muln(INITIAL_BAS_FOR_DAI_BAS)
  const totalBalance = totalBalanceForDAIBAC.add(totalBalanceForDAIBAS);

  const share = await MahaToken.deployed();

  const lpPoolDAIBAC = artifacts.require(basPools.DAIBAC.contractName);
  const lpPoolDAIBAS = artifacts.require(basPools.DAIBAS.contractName);

  await deployer.deploy(
    InitialShareDistributor,
    share.address,
    lpPoolDAIBAC.address,
    totalBalanceForDAIBAC.toString(),
    lpPoolDAIBAS.address,
    totalBalanceForDAIBAS.toString(),
  );
  const distributor = await InitialShareDistributor.deployed();

  await share.mint(distributor.address, totalBalance.toString());
  console.log(`Deposited ${INITIAL_BAS_FOR_DAI_BAC} BAS to InitialShareDistributor.`);

  console.log(`Setting distributor to InitialShareDistributor (${distributor.address})`);
  await lpPoolDAIBAC.deployed().then(pool => pool.setRewardDistribution(distributor.address));
  await lpPoolDAIBAS.deployed().then(pool => pool.setRewardDistribution(distributor.address));

  await distributor.distribute();
}


module.exports = migration;
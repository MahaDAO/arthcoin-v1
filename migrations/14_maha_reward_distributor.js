const { 
  INITIAL_MAHA_FOR_DAI_MAHA, 
  INITIAL_MAHA_FOR_DAI_ARTH 
} = require('./config');

const {
  mahaPools,
} = require('./pools');


const MahaToken = artifacts.require('MahaToken');
const InitialShareDistributor = artifacts.require('InitialShareDistributor');


/**
 * Main migrations
 */
async function migration(deployer, network, accounts) {
  return

  // Set the main account, you'll be using accross all the files for various
  // important activities to your desired address in the .env file.
  accounts[0] = process.env.WALLET_KEY;

  const unit = web3.utils.toBN(10 ** 18);
  const totalBalanceForDAIARTH = unit.muln(INITIAL_MAHA_FOR_DAI_ARTH)
  const totalBalanceForDAIMAHA = unit.muln(INITIAL_MAHA_FOR_DAI_MAHA)
  const totalBalance = totalBalanceForDAIARTH.add(totalBalanceForDAIMAHA);

  const share = await MahaToken.deployed();

  const lpPoolDAIARTH = artifacts.require(mahaPools.DAIARTH.contractName);
  const lpPoolDAIMAHA = artifacts.require(mahaPools.DAIMAHA.contractName);

  await deployer.deploy(
    InitialShareDistributor,
    share.address,
    lpPoolDAIARTH.address,
    totalBalanceForDAIARTH.toString(),
    lpPoolDAIMAHA.address,
    totalBalanceForDAIMAHA.toString(),
  );
  const distributor = await InitialShareDistributor.deployed();

  await share.mint(distributor.address, totalBalance.toString());
  console.log(`Deposited ${INITIAL_MAHA_FOR_DAI_ARTH} MAHA to InitialShareDistributor.`);

  console.log(`Setting distributor to InitialShareDistributor (${distributor.address})`);
  await lpPoolDAIARTH.deployed().then(pool => pool.setRewardDistribution(distributor.address));
  await lpPoolDAIMAHA.deployed().then(pool => pool.setRewardDistribution(distributor.address));

  await distributor.distribute();
}


module.exports = migration;
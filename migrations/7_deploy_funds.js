const BurnbackFund = artifacts.require('BurnbackFund');
const DevelopmentFund = artifacts.require('DevelopmentFund');


async function migration(deployer, network, accounts) {
  // Set the main account, you'll be using accross all the files for
  // various important activities to your desired address in the .env
  // file.
  accounts[0] = process.env.WALLET_KEY;
  
  // Deploy funds.
  console.log('Deploying funds.')
  await deployer.deploy(DevelopmentFund);

  await deployer.deploy(BurnbackFund);
}


module.exports = migration;

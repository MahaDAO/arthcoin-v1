const ARTH = artifacts.require('ARTH');
const ARTHB = artifacts.require('ARTHB');
const Maharaja = artifacts.require('Maharaja');


async function migration(deployer, network, accounts) {
  console.log('Deploying maharaja');
  await deployer.deploy(Maharaja, ARTH.address, ARTHB.address);
}


module.exports = migration;

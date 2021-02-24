const ARTH = artifacts.require('ARTH');
const ARTHB = artifacts.require('ARTHB');
const Maharaja = artifacts.require('Maharaja');


async function migration(deployer, network, accounts) {
  console.log('Deploying maharaja');
  await deployer.deploy(Maharaja, ARTH.address, ARTHB.address);

  const arth = await ARTH.deployed();
  const arthb = await ARTHB.deployed();

  console.log('transfer operator and ownership of ARTH to maharaja')
  await arth.transferOperator(Maharaja.address);
  await arth.transferOwnership(Maharaja.address);

  console.log('transfer operator and ownership of ARTHB to maharaja')
  await arthb.transferOperator(Maharaja.address);
  await arthb.transferOwnership(Maharaja.address);
}


module.exports = migration;

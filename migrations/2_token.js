const {  getDAI, getMahaToken } = require('./helpers');
const ARTH = artifacts.require('ARTH');
const ARTHB = artifacts.require('ARTHB');


const migration = async (deployer, network, accounts) => {
  // Set the main account, you'll be using accross all the files for
  // various important activities to your desired address in the .env
  // file.
  accounts[0] = process.env.WALLET_KEY;

  await deployer.deploy(ARTH);
  await deployer.deploy(ARTHB);
  await getDAI(network, deployer, artifacts);
  await getMahaToken(network, deployer, artifacts);

  const cash = await ARTH.deployed();
  console.log('Minting 1 ARTH token.');
  await cash.mint(accounts[0], web3.utils.toBN(10 ** 18).toString());
};


module.exports = migration;

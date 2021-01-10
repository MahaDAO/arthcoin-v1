const { BigNumber } = require("ethers");

const { DAY } = require('./config');


const ArthLiquidityBoardroom = artifacts.require('ArthLiquidityBoardroom');
const ArthBoardroom = artifacts.require('ArthBoardroom');
const Treasury = artifacts.require('Treasury');
const ARTH = artifacts.require('ARTH');
const MAHAUSDOracle = artifacts.require('MAHAUSDOracle');
const GMUOracle = artifacts.require('GMUOracle');
const ARTHB = artifacts.require('ARTHB');
const Timelock = artifacts.require('Timelock');


/**
 * Main migrations
 */
module.exports = async (deployer, network, accounts) => {
  // Set the main account, you'll be using accross all the files for various
  // important activities to your desired address in the .env file.
  accounts[0] = process.env.WALLET_KEY;

  const cash = await ARTH.deployed();
  const bond = await ARTHB.deployed();
  const treasury = await Treasury.deployed();
  const mahaOracle = await MAHAUSDOracle.deployed();
  const gmuOracle = await GMUOracle.deployed();

  const arthLiquidityBoardroom = await ArthLiquidityBoardroom.deployed();
  const arthBoardroom = await ArthBoardroom.deployed();

  for await (const contract of [cash, bond]) {
    console.log(`transferring operator for ${contract.address} to ${treasury.address}`)
    await contract.transferOperator(treasury.address);
    console.log(`transferring ownership for ${contract.address} to ${treasury.address}`)
    await contract.transferOwnership(treasury.address);
  }

  console.log('transferring operator for boardrooms')
  await arthLiquidityBoardroom.transferOperator(treasury.address);
  await arthBoardroom.transferOperator(treasury.address);

  // If mainnet only then migrate ownership to a timelocked contract; else keep it the same user
  // with no timelock.
  if (network === 'mainnet') {
    console.log('creating and adding timelocks')
    const timelock = await deployer.deploy(Timelock, accounts[0], 2 * DAY);
    await arthLiquidityBoardroom.transferOwnership(timelock.address);
    await arthBoardroom.transferOwnership(timelock.address);

    console.log('migrating operator and ownership of treasury to timelock')
    await treasury.transferOperator(timelock.address);
    await treasury.transferOwnership(timelock.address);
  } else if (process.env.METAMASK_WALLET) {
    console.log('transfering operator and owenrship of boardroom/treasury to metamask wallets')
    await arthLiquidityBoardroom.transferOwnership(process.env.METAMASK_WALLET);
    await arthBoardroom.transferOwnership(process.env.METAMASK_WALLET);
    await treasury.transferOperator(process.env.METAMASK_WALLET);
    await treasury.transferOwnership(process.env.METAMASK_WALLET);
    await treasury.transferOwnership(process.env.METAMASK_WALLET);
    await gmuOracle.transferOwnership(process.env.METAMASK_WALLET);
    await mahaOracle.transferOwnership(process.env.METAMASK_WALLET);

    if (network === 'development') {
      console.log('sending 1 eth to the metamask wallet')
      const amountToSend = web3.utils.toWei("1", "ether"); // Convert to wei value
      web3.eth.sendTransaction({ from: accounts[0], to: process.env.METAMASK_WALLET, value: String(amountToSend) });
    }
  }

  console.log(`Transferred the operator role from the deployer (${accounts[0]}) to Treasury (${Treasury.address})`);
}

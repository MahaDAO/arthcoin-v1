const Boardroom = artifacts.require('Boardroom');
const Treasury = artifacts.require('Treasury');
const Cash = artifacts.require('Cash');
const Bond = artifacts.require('Bond');
const MahaToken = artifacts.require('MahaToken');
const Timelock = artifacts.require('Timelock');


const DAY = 86400;


/**
 * Main migrations
 */
module.exports = async (deployer, network, accounts) => {
  // Set the main account, you'll be using accross all the files for various
  // important activities to your desired address in the .env file.
  accounts[0] = process.env.WALLET_KEY;

  const cash = await Cash.deployed();
  const share = await MahaToken.deployed();
  const bond = await Bond.deployed();
  const treasury = await Treasury.deployed();
  const boardroom = await Boardroom.deployed();


  for await (const contract of [cash, share, bond]) {
    console.log(`transferring operator for ${contract.address} to ${treasury.address}`)
    await contract.transferOperator(treasury.address);
    console.log(`transferring ownership for ${contract.address} to ${treasury.address}`)
    await contract.transferOwnership(treasury.address);
  }

  console.log(`transferring operator for ${boardroom.address} to ${treasury.address}`)
  await boardroom.transferOperator(treasury.address);


  if (network !== 'mainnet') {
    console.log(`transferring operator for boardroom and treasurey to ${accounts[0]}`)
    // for dev environments; don't need to add a timelock contract
    await boardroom.transferOwnership(accounts[0]);
    await treasury.transferOperator(accounts[0]);
    await treasury.transferOwnership(accounts[0]);
  } else {
    const timelock = await deployer.deploy(Timelock, accounts[0], 2 * DAY);

    console.log(`transferring operator for boardroom and treasurey to ${timelock.address}`)
    await boardroom.transferOwnership(timelock.address);
    await treasury.transferOperator(timelock.address);
    await treasury.transferOwnership(timelock.address);
  }

  console.log(`Transferred the operator role from the deployer (${accounts[0]}) to Treasury (${Treasury.address})`);
}

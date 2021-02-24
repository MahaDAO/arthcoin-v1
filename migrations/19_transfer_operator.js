const Treasury = artifacts.require('Treasury');


const GMUOracle = artifacts.require('GMUOracle');
const Timelock = artifacts.require('Timelock');

const ArthArthBoardroomV2 = artifacts.require('ArthArthBoardroomV2');
const ArthArthMlpLiquidityBoardroomV2 = artifacts.require('ArthArthMlpLiquidityBoardroomV2')
const ArthMahaBoardroomV2 = artifacts.require('ArthMahaBoardroomV2');
const MahaArthBoardroomV2 = artifacts.require('MahaArthBoardroomV2');
const MahaArthMlpLiquidityBoardroomV2 = artifacts.require('MahaArthMlpLiquidityBoardroomV2');
const MahaMahaBoardroomV2 = artifacts.require('MahaMahaBoardroomV2');

/**
 * Main migrations
 */
module.exports = async (deployer, network, accounts) => {
  // Set the main account, you'll be using accross all the files for various
  // important activities to your desired address in the .env file.
  accounts[0] = process.env.WALLET_KEY;

  const treasury = await Treasury.deployed();
  const gmuOracle = await GMUOracle.deployed();

  const arthArthBoardroomV2 = await ArthArthBoardroomV2.deployed();
  const arthArthMlpLiquidityBoardroomV2 = await ArthArthMlpLiquidityBoardroomV2.deployed();
  const arthMahaBoardroomV2 = await ArthMahaBoardroomV2.deployed();
  const mahaArthBoardroomV2 = await MahaArthBoardroomV2.deployed();
  const mahaArthMlpLiquidityBoardroomV2 = await MahaArthMlpLiquidityBoardroomV2.deployed();
  const mahaMahaBoardroomV2 = await MahaMahaBoardroomV2.deployed();

  console.log('transferring operator for boardrooms')

  await arthArthBoardroomV2.transferOperator(treasury.address);
  await arthArthMlpLiquidityBoardroomV2.transferOperator(treasury.address);
  await arthMahaBoardroomV2.transferOperator(treasury.address);
  await mahaArthBoardroomV2.transferOperator(treasury.address);
  await mahaArthMlpLiquidityBoardroomV2.transferOperator(treasury.address);
  await mahaMahaBoardroomV2.transferOperator(treasury.address);

  // If mainnet only then migrate ownership to a timelocked contract; else keep it the same user
  // with no timelock.

  const newOwner = network === 'mainnet' ? process.env.HARDWARE_WALLET : process.env.METAMASK_WALLET;

  if (newOwner) {
    await arthArthBoardroomV2.transferOwnership(newOwner);
    await arthArthMlpLiquidityBoardroomV2.transferOwnership(newOwner);
    await arthMahaBoardroomV2.transferOwnership(newOwner);
    await mahaArthBoardroomV2.transferOwnership(newOwner);
    await mahaArthMlpLiquidityBoardroomV2.transferOwnership(newOwner);
    await mahaMahaBoardroomV2.transferOwnership(newOwner);

    await gmuOracle.transferOwnership(newOwner);

    await treasury.transferOperator(newOwner);
    await treasury.transferOwnership(newOwner);
  }

  if (network === 'mainnet') {
    // console.log('creating and adding timelocks')
    // const timelock = await deployer.deploy(Timelock, accounts[0], 2 * 86400);
    // await arthMlpLiquidityBoardroomV2.transferOwnership(timelock.address);
    // await arthUniLiquidityBoardroomV2.transferOwnership(timelock.address);
    // await mahaLiquidityBoardroom.transferOwnership(timelock.address);
    // await arthBoardroom.transferOwnership(timelock.address);

    // console.log('migrating operator and ownership of treasury to timelock')
    // await treasury.transferOperator(timelock.address);
    // await treasury.transferOwnership(timelock.address);
  }

  if (network === 'development' && process.env.METAMASK_WALLET) {
    console.log('sending 1 eth to the metamask wallet')
    const amountToSend = web3.utils.toWei("1", "ether"); // Convert to wei value
    web3.eth.sendTransaction({ from: accounts[0], to: process.env.METAMASK_WALLET, value: String(amountToSend) });
  }

  console.log(`Transferred the operator role from the deployer (${accounts[0]}) to Treasury (${Treasury.address})`);
};

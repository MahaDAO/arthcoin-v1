import { ethers } from 'hardhat';

const snapshot: any[] = require('./snapshots/maha.json')

async function main() {
  // Fetch the provider.
  const { provider } = ethers;

  const estimateGasPrice = await provider.getGasPrice();
  const gasPrice = estimateGasPrice.mul(3).div(2);
  console.log(`Gas Price: ${ethers.utils.formatUnits(gasPrice, 'gwei')} gwei`);

  // Fetch the wallet accounts.
  const [operator,] = await ethers.getSigners();

  // Fetch contract factories.

  const address = '0x79Fe0ac571cf3C1c1d7ffFFd4AaeB868F406acCc'

  const boardroom = await ethers.getContractAt('SnapshotBoardroom', address);

  console.log(`uploading ${snapshot.length} addresses`)

  const directors = snapshot.map(s => s.addr)
  const balances = snapshot.map(s => s.balance)
  console.log(balances, directors)
  // await boardroom.methods.setBalances()
}


main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });

import { ethers } from 'hardhat';

const snapshot: any[] = require('./snapshots/arthDai.json')

async function main() {
  // Fetch the provider.
  const { provider } = ethers;

  const estimateGasPrice = await provider.getGasPrice();
  const gasPrice = estimateGasPrice.mul(3).div(2);
  console.log(`Gas Price: ${ethers.utils.formatUnits(gasPrice, 'gwei')} gwei`);

  // Fetch the wallet accounts.
  const [operator,] = await ethers.getSigners();

  // Fetch contract factories.

  const address = '0xcBa6Ef8DF713BD427a44D27dBcF05C4c9d6E7Fbb'

  const boardroom = await ethers.getContractAt('SnapshotBoardroom', address);


  const filtered = snapshot.filter(d => Number(d.balance) > 0)
  console.log(`uploading ${filtered.length} addresses`)

  const directors = filtered.map(s => s.addr)
  const balances = filtered.map(s => s.balance)
  await boardroom.setBalances(directors, balances)

  console.log('uploading done')
}


main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });

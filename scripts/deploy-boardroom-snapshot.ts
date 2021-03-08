import { ethers } from 'hardhat';


async function main() {
  // Fetch the provider.
  const { provider } = ethers;

  const estimateGasPrice = await provider.getGasPrice();
  const gasPrice = estimateGasPrice.mul(3).div(2);
  console.log(`Gas Price: ${ethers.utils.formatUnits(gasPrice, 'gwei')} gwei`);

  // Fetch the wallet accounts.
  const [operator,] = await ethers.getSigners();

  // Fetch contract factories.

  const boardroomName = 'SnapshotBoardroom'
  const arthToken = '0x0e3cc2c4fb9252d17d07c67135e48536071735d9'
  const treasury = '0x2806e2e25480856432edb151e2975b6a49a5e079'

  const Boardroom = await ethers.getContractFactory(boardroomName);

  // Fetch existing contracts.

  const params = [arthToken, treasury]
  const boardroom = await Boardroom.connect(operator).deploy(...params);

  console.log(`\n Boardroom details: `, boardroomName)
  console.log(` - New boardroom at address(${boardroom.address})`)
  console.log(` - New boardroom params: ${JSON.stringify(params)}`)
}


main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });

import { network, ethers } from 'hardhat';


async function main() {
  // Fetch the provider.
  const { provider } = ethers;

  const estimateGasPrice = await provider.getGasPrice();
  const gasPrice = estimateGasPrice.mul(3).div(2);
  console.log(`Gas Price: ${ethers.utils.formatUnits(gasPrice, 'gwei')} gwei`);

  // Fetch the wallet accounts.
  const [operator,] = await ethers.getSigners();

  // Fetch contract factories.

  const boardroomName = 'ArthArthMlpLiquidityBoardroomV2'

  const rewardToken = '0x0e3cc2c4fb9252d17d07c67135e48536071735d9'
  const vaultAddr = '0x4A3201A61a998E8f43C942532a72B9c80708Aa58'

  const Boardroom = await ethers.getContractFactory(boardroomName);

  // Fetch existing contracts.
  // Deploy new treasury.

  const hour = 3600
  const params = [
    rewardToken,
    vaultAddr,
    // hour * 8
  ]
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

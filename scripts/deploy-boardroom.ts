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

  const boardroomName = 'ArthMahaBoardroomV2'
  // const vaultToken = '0x0E3cC2c4FB9252d17d07C67135E48536071735D9'
  const vaultAddr = '0xa0B708358CDC1bA16214a382547c166314135302'
  const rweardToken = '0x0e3cc2c4fb9252d17d07c67135e48536071735d9'

  const Vaults = await ethers.getContractFactory(boardroomName);

  // Fetch existing contracts.
  // Deploy new treasury.

  const hour = 3600
  const params = [
    rweardToken,
    vaultAddr,
    hour * 8
  ]
  const vault = await Vaults.connect(operator).deploy(...params);

  console.log(`\n Vault details: `)
  console.log(` - New boardroom at address(${vault.address})`)
  console.log(` - New vault params: ${JSON.stringify(params)}`)
}


main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });

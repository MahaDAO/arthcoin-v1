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

  const vaultName = 'VaultArthMlp'
  // const vaultToken = '0x0E3cC2c4FB9252d17d07C67135E48536071735D9'
  const vaultToken = '0xe207492fad13324b3b80b1a4324a203b61fc11a6'

  const Vaults = await ethers.getContractFactory(vaultName);

  // Fetch existing contracts.
  // Deploy new treasury.

  const day = 86400
  const params = [
    vaultToken,
    day
  ]
  const vault = await Vaults.connect(operator).deploy(...params);

  console.log(`\n Vault details: `)
  console.log(` - New vault at address(${vault.address})`)
  console.log(` - New vault params: ${JSON.stringify(params)}`)
}


main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });

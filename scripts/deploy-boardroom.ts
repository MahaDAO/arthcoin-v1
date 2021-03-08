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

  const vaults = {
    arthDai: '0xbc2199f9e42239c1003ada698571b181aea09f64',
    arthEth: '0x4a3201a61a998e8f43c942532a72b9c80708aa58',
    arth: '0x44811eff0f4dd2d7cb093a6d33bb6202eb2edf06',
    maha: '0xa0b708358cdc1ba16214a382547c166314135302',
  }



  const boardroomName = 'VaultBoardroom'

  const arthToken = '0x0e3cc2c4fb9252d17d07c67135e48536071735d9'
  const vaultAddr = vaults.arth

  const Boardroom = await ethers.getContractFactory(boardroomName);

  // Fetch existing contracts.

  const params = [
    arthToken,
    vaultAddr,
    '0xeccE08c2636820a81FC0c805dBDC7D846636bbc4',
    '0x2806e2e25480856432edb151e2975b6a49a5e079'
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

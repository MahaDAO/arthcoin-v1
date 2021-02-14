import { network, ethers } from 'hardhat';


async function main() {
  // Fetch the provider.
  const { provider } = ethers;

  const estimateGasPrice = await provider.getGasPrice();
  const gasPrice = estimateGasPrice.mul(5).div(2);
  console.log(`Gas Price: ${ethers.utils.formatUnits(gasPrice, 'gwei')} gwei`);

  // Fetch the wallet accounts.
  const [operator] = await ethers.getSigners();

  // Fetch contract factories.
  const poolName = 'MAHADAIARTHMLPTokenPool'
  const Pool = await ethers.getContractFactory(poolName);

  // Deploy new treasury.

  const POOL_START_DATE = Math.floor(new Date("Feb 9 2021 15:00:10 GMT+0000").getTime() / 1000)
  const params = [
    '0xb4d930279552397bba2ee473229f89ec245bc365',
    '0x1c36d9e60cac6893652b74e357f3829a0f5095e0',
    POOL_START_DATE
  ]

  const pool = await Pool.connect(operator).deploy(...params);
  console.log('new pool is at', pool.address)

}


main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });

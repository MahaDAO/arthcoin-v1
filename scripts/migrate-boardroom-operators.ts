import { network, ethers } from 'hardhat';
import Bluebird from 'bluebird';

async function main() {
  // Fetch the provider.
  const { provider } = ethers;

  const estimateGasPrice = await provider.getGasPrice();
  const gasPrice = estimateGasPrice.mul(3).div(2);
  console.log(`Gas Price: ${ethers.utils.formatUnits(gasPrice, 'gwei')} gwei`);

  // Fetch contract factories.
  const dest = '0x2806e2e25480856432edb151e2975b6a49a5e079'

  const boardrooms = [
    // '0x40436065DFed8eb07F8ea26E2a47114a82B58d80',
    // '0x5b0C55212b77617Bb50bd7F832Df2c72a0e46Bb7',
    '0x4A3201A61a998E8f43C942532a72B9c80708Aa58',
  ]

  await Bluebird.mapSeries(boardrooms, async b => {
    const boardroom = await ethers.getContractAt('Operator', b);
    await boardroom.transferOperator(dest);
    console.log(` - operator for ${b} migrated to: ${dest}`);
  });
}


main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });

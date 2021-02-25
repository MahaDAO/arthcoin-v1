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
    '0x3178fcCeA39C32983750C6C5b9B9E41BDB72F466',
    '0xDd15E72441F3C28fb5528E62640DC233C5a0439D',
    '0x6A7cd1CeF2D28512779ad81A53d2Ab74F08AcF6b',
  ]

  await Bluebird.mapSeries(boardrooms, async b => {
    const boardroom = await ethers.getContractAt('VestedVaultBoardroom', b);
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

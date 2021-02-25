import { network, ethers } from 'hardhat';
import  Bluebird from 'bluebird';


async function main() {
  // Fetch the provider.
  const { provider } = ethers;

  const estimateGasPrice = await provider.getGasPrice();
  const gasPrice = estimateGasPrice.mul(3).div(2);
  console.log(`Gas Price: ${ethers.utils.formatUnits(gasPrice, 'gwei')} gwei`);

  // Fetch contract factories.
  const dest = '0xeccE08c2636820a81FC0c805dBDC7D846636bbc4'

  const contracts = [
    '0x44811eff0f4dd2d7cb093a6d33bb6202eb2edf06',
    '0xbc2199f9e42239c1003ada698571b181aea09f64',
    '0xa0B708358CDC1bA16214a382547c166314135302',

    '0x3178fcCeA39C32983750C6C5b9B9E41BDB72F466',
    '0xDd15E72441F3C28fb5528E62640DC233C5a0439D',
    '0x6A7cd1CeF2D28512779ad81A53d2Ab74F08AcF6b',
  ]

  await Bluebird.mapSeries(contracts, async b => {
    const c = await ethers.getContractAt('Ownable', b);
    await c.transferOwnership(dest);
    console.log(` - ownership of ${b} migrated to: ${dest}`);
  });
}


main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });

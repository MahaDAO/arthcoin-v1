import { network, ethers } from 'hardhat';


async function main() {
  // Fetch the provider.
  const { provider } = ethers;

  const estimateGasPrice = await provider.getGasPrice();
  const gasPrice = estimateGasPrice.mul(3).div(2);
  console.log(`Gas Price: ${ethers.utils.formatUnits(gasPrice, 'gwei')} gwei`);

  // Fetch the wallet accounts.
  const [operator,] = await ethers.getSigners();

  // Fetch already deployed contracts.
  const deployements = require(`../deployments/2021-01-21.json`);

  // Fetch contract factories.
  const Treasury = await ethers.getContractFactory('Treasury');

  // Fetch existing contracts.
  const treasury = await ethers.getContractAt('Treasury', deployements.Treasury.address);

  // Deploy new treasury.

  const params = [
    await treasury.dai(),
    await treasury.cash(),
    await treasury.bond(),
    await treasury.share(),

    await treasury.bondOracle(),
    await treasury.arthMahaOracle(),
    await treasury.seigniorageOracle(),
    await treasury.gmuOracle(),

    await treasury.arthLiquidityBoardroom(),
    await treasury.mahaLiquidityBoardroom(),
    await treasury.arthBoardroom(),
    await treasury.ecosystemFund(),

    await treasury.uniswapRouter(),
    1611331200,
    43200,
    11
  ]

  const newTreasury = await Treasury.connect(operator).deploy(...params);

  console.log(`\nTreasury details: `)
  console.log(` - Old treasury at address(${treasury.address})`)
  console.log(` - New treasury at address(${newTreasury.address})`)

  console.log(` - New treasury params: ${JSON.stringify(params)}`)
}


main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });

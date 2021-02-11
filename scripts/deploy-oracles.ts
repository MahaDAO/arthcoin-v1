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
  const Oracle = await ethers.getContractFactory('ArthDaiOneHourTWAPOracle');

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

  const newTreasury = await Oracle.connect(operator).deploy(...params);

  console.log(`\details: `)
  console.log(` - New address(${newTreasury.address})`)

  console.log(` - New params: ${JSON.stringify(params)}`)
}


main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });

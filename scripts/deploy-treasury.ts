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
  const deployements = require(`../deployments/2021-01-25.json`);

  // Fetch contract factories.
  const Treasury = await ethers.getContractFactory('Treasury');

  // Fetch existing contracts.

  // Deploy new treasury.

  // const params = [
  //   await treasury.dai(),
  //   await treasury.cash(),
  //   await treasury.bond(),
  //   await treasury.share(),

  //   await treasury.bondOracle(),
  //   await treasury.arthMahaOracle(),
  //   await treasury.seigniorageOracle(),
  //   await treasury.gmuOracle(),

  //   await treasury.arthLiquidityBoardroom(),
  //   await treasury.mahaLiquidityBoardroom(),
  //   await treasury.arthBoardroom(),
  //   await treasury.ecosystemFund(),

  //   await treasury.uniswapRouter(),
  //   1611331200,
  //   43200,
  //   11
  // ]

  const params = [
    '0x6B175474E89094C44Da98b954EedeAC495271d0F', // dai
    '0x0E3cC2c4FB9252d17d07C67135E48536071735D9', // cash
    '0xE3D620Ca72FF970F5b36a2b2d51AfDBBDBCe59b5', // bond
    '0xB4d930279552397bbA2ee473229f89Ec245bc365', // share

    '0x26ac78d87d2850f6db7ca48d68723702e79ea52f', // 1hr oracle
    '0xcd24eFb0F7285Cb923caB11a85fBdb1523f10011', // arth-maha oracle
    '0xc31b6dbf7bd28b822dd2e4413b5034bae3811888', // 12hr oracle
    '0xcD0eFae7FA77bFddA4e4997452F3DeB06F290a08', // gmu oracle

    // '0xd5f501c4cdbfca915f04d4ae3853a904c9a35af5', // arth uni liq boardroom
    // '0xd5f501c4cdbfca915f04d4ae3853a904c9a35af5', // arth mlp liq boardroom
    // '0x677d54d7DEf7Da25addE1827e000b81A65b1F408', // maha liq boardroom
    // '0xdEc0b3bD49347c75fe1C44A219aB474a13e68FfD', // arth boardroom
    // '0x5aC2A32BFa475765558CEa2A0Fe0bF0207D58Ca4', // ecosystem fund
    // '0x5aC2A32BFa475765558CEa2A0Fe0bF0207D58Ca4', // rainyday fund

    '0xCDcF57Dfa6eFd5862b0f8F37a611876CA4aad3f9', // uni router
    1611331200, // start time
    43200, // epoch
    41 // current epoch
  ]

  console.log(params)

  const newTreasury = await Treasury.connect(operator).deploy(...params);

  console.log(`\nTreasury details: `)
  // console.log(` - Old treasury at address(${treasury.address})`)
  console.log(` - New treasury at address(${newTreasury.address})`)

  console.log(` - New treasury params: ${JSON.stringify(params)}`)
}


main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });

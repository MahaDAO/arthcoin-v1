// import { ethers } from 'hardhat';
// const hre = require("hardhat");
const { ethers } = require('hardhat')

const params = [
  '0x1c36d9e60cac6893652b74e357f3829a0f5095e0', // pair
  1611327600 // start time
]

async function main() {
  // Fetch the provider.
  const { provider } = ethers;

  const estimateGasPrice = await provider.getGasPrice();
  const gasPrice = estimateGasPrice.mul(3).div(2);
  console.log(`Gas Price: ${ethers.utils.formatUnits(gasPrice, 'gwei')} gwei`);

  // Fetch the wallet accounts.
  const [operator,] = await ethers.getSigners();

  // Fetch contract factories.
const Oracle = await ethers.getContractFactory('ArthDaiTwelveHourTWAPOracle');

  const oracle = await Oracle.connect(operator).deploy(...params);
  const addrs = oracle.address;
  // const addrs = '0x26ac78d87d2850f6db7ca48d68723702e79ea52f';

  console.log(`\oracle details: `);
  console.log(` - New oracle at address(${oracle.address})`);
  console.log(` - New oracle params: ${JSON.stringify(params)}`);

  // await hre.run("verify:verify", {
  //   address: oracle.address,
  //   contract: '',
  //   constructorArguments: params
  // });
}


main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });


module.exports = params;
// npx hardhat verify --contract contracts/oracles/ArthDaiTwelveHourTWAPOracle.sol:ArthDaiTwelveHourTWAPOracle  --constructor-args scripts/deploy-oracle.js 0xC31B6DBf7bD28B822Dd2e4413B5034BAE3811888 --network mainnet

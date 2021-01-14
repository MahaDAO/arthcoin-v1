import { network, ethers } from 'hardhat';
import { ParamType, keccak256 } from 'ethers/lib/utils';

import {
  DAI,
  ORACLE_START_DATE,
  TREASURY_START_DATE,
  UNI_FACTORY,
} from '../deploy.config';

const knownContracts = require('../migrations/known-contracts.js')
import OLD from '../deployments/1.json';
import { encodeParameters, wait } from './utils';

const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

async function main() {
  if (network.name !== 'ropsten') {
    throw new Error('wrong network');
  }

  const { provider } = ethers;
  const [operator] = await ethers.getSigners();

  const estimateGasPrice = await provider.getGasPrice();
  const gasPrice = estimateGasPrice.mul(3).div(2);
  const override = { gasPrice };

  // Fetch existing contracts
  // === token
  const cash = await ethers.getContractAt('ARTH', OLD.ARTH.address);
  const bond = await ethers.getContractAt('ARTHB', OLD.ARTHB.address);
  const dai = await ethers.getContractAt('IERC20', '0x760AE87bBCEFa2CF76B6E0F9bCe80c1408764936');
  const share = await ethers.getContractAt('MahaToken', OLD.MahaToken.address);

  const bondRedemtionOracle = await ethers.getContractAt('BondRedemtionOracle', OLD.BondRedemtionOracle.address);
  const mahausdOracle = await ethers.getContractAt('MAHAUSDOracle', OLD.MAHAUSDOracle.address);
  const seigniorageOracle = await ethers.getContractAt('SeigniorageOracle', OLD.SeigniorageOracle.address);
  const arthLiquidityBoardroom = await ethers.getContractAt('ArthLiquidityBoardroom', OLD.ArthLiquidityBoardroom.address);
  const arthBoardroom = await ethers.getContractAt('ArthBoardroom', OLD.ArthBoardroom.address);
  const developmentFund = await ethers.getContractAt('DevelopmentFund', OLD.DevelopmentFund.address);
  const gmuOracle = await ethers.getContractAt('GMUOracle', OLD.GMUOracle.address);

  const oldTreasury = await ethers.getContractAt('Treasury', OLD.Treasury.address);


  const Treasury = await ethers.getContractFactory('Treasury');


  if (operator.address !== (await oldTreasury.owner())) {
    throw new Error(`Invalid admin ${operator.address}`);
  }
  console.log(`Admin verified ${operator.address}`);

  console.log('Deploying new treasury.')


  const POOL_START_DATE = Math.floor(Date.now() / 1000);
  const TREASURY_PERIOD = 60 * 60;

  const d = encodeParameters(ethers, [
    'address',
    'address',
    'address',
    'address',
    'address',
    'address',
    'address',
    'address',
    'address',
    'address',
    'address',
    'address',
    'uint256',
    'uint256 ',
  ],
    [
      dai.address,
      cash.address,
      bond.address,
      share.address,
      bondRedemtionOracle.address,
      mahausdOracle.address,
      seigniorageOracle.address,
      arthLiquidityBoardroom.address,
      arthBoardroom.address,
      developmentFund.address,
      knownContracts.UniswapV2Router02[network.name],
      gmuOracle.address,
      POOL_START_DATE,
      TREASURY_PERIOD,
    ])

  console.log(d)
  console.log([
    dai.address,
    cash.address,
    bond.address,
    share.address,
    bondRedemtionOracle.address,
    mahausdOracle.address,
    seigniorageOracle.address,
    arthLiquidityBoardroom.address,
    arthBoardroom.address,
    developmentFund.address,
    knownContracts.UniswapV2Router02[network.name],
    gmuOracle.address,
    POOL_START_DATE,
    TREASURY_PERIOD,
  ])
  const newTreasury = await Treasury.connect(operator).deploy(
    dai.address,
    cash.address,
    bond.address,
    share.address,
    bondRedemtionOracle.address,
    mahausdOracle.address,
    seigniorageOracle.address,
    arthLiquidityBoardroom.address,
    arthBoardroom.address,
    developmentFund.address,
    knownContracts.UniswapV2Router02[network.name],
    gmuOracle.address,
    POOL_START_DATE,
    TREASURY_PERIOD,
    override
  );

  console.log('newTreasury at', newTreasury.address)

  return
  // await deployer.deploy(
  //   Treasury,
  //   dai.address,
  //   ARTH.address,
  //   ARTHB.address,
  //   MahaToken.address,
  //   BondRedemtionOracle.address,
  //   MAHAUSDOracle.address,
  //   SeigniorageOracle.address,
  //   ArthLiquidityBoardroom.address,
  //   ArthBoardroom.address,
  //   DevelopmentFund.address,
  //   uniswapRouter.address,
  //   GMUOracle.address,
  //   POOL_START_DATE,
  //   TREASURY_PERIOD
  // );
  // const Oracle = await ethers.getContractFactory('Oracle');
  // const Treasury = await ethers.getContractFactory('Treasury');
  // // const Boardroom = await ethers.getContractFactory('Boardroom');
  // const SimpleFund = await ethers.getContractFactory('SimpleERCFund');

  // let tx;

  // console.log('\n===================================================\n');

  // console.log('=> Deploy\n');

  // const simpleFund = await SimpleFund.connect(operator).deploy();
  // await wait(
  //   ethers,
  //   simpleFund.deployTransaction.hash,
  //   `\nDeploy fund contract => ${simpleFund.address}`
  // );


  // const newTreasury = await Treasury.connect(operator).deploy(
  //   cash.address,
  //   bond.address,
  //   share.address,
  //   bondOracle.address,
  //   seigniorageOracle.address,
  //   boardroom.address,
  //   simpleFund.address,
  //   TREASURY_START_DATE,
  //   override
  // );

  // await wait(
  //   ethers,
  //   newTreasury.deployTransaction.hash,
  //   `\nDeploy new Treasury => ${newTreasury.address}`
  // );

  // console.log('\n===================================================\n');

  // console.log('=> RBAC\n');

  // // tx = await newBoardroom
  // //   .connect(operator)
  // //   .transferOperator(newTreasury.address, override);
  // // await wait(tx.hash, 'boardroom.transferOperator');

  // // tx = await newBoardroom
  // //   .connect(operator)
  // //   .transferOwnership(timelock.address, override);
  // // await wait(tx.hash, 'boardroom.transferOwnership');

  // tx = await simpleFund
  //   .connect(operator)
  //   .transferOperator(timelock.address, override);
  // await wait(ethers, tx.hash, 'fund.transferOperator');

  // tx = await simpleFund
  //   .connect(operator)
  //   .transferOwnership(timelock.address, override);
  // await wait(ethers, tx.hash, 'fund.transferOwnership');

  // tx = await newTreasury
  //   .connect(operator)
  //   .transferOperator(timelock.address, override);
  // await wait(ethers, tx.hash, 'treasury.transferOperator');

  // tx = await newTreasury
  //   .connect(operator)
  //   .transferOwnership(timelock.address, override);
  // await wait(ethers, tx.hash, 'treasury.transferOwnership');

  // console.log('\n===================================================\n');

  // console.log('=> Migration\n');

  // let eta;
  // let calldata;
  // let txHash;

  // // 1. transfer operator to old treasury
  // eta = Math.round(new Date().getTime() / 1000) + 2 * DAY + 60;
  // calldata = [
  //   boardroom.address,
  //   0,
  //   'transferOperator(address)',
  //   encodeParameters(ethers, ['address'], [oldTreasury.address]),
  //   eta,
  // ];
  // txHash = keccak256(
  //   encodeParameters(
  //     ethers,
  //     ['address', 'uint256', 'string', 'bytes', 'uint256'],
  //     calldata
  //   )
  // );

  // tx = await timelock.connect(operator).queueTransaction(...calldata, override);
  // await wait(
  //   ethers,
  //   tx.hash,
  //   `\n1. timelock.queueTransaction (boardroom.transferOperator) => txHash: ${txHash}`
  // );
  // console.log(`Tx execution ETA: ${eta}`);

  // if (!(await timelock.connect(operator).queuedTransactions(txHash))) {
  //   throw new Error('wtf');
  // }

  // // 2. migrate treasury
  // eta = Math.round(new Date().getTime() / 1000) + 2 * DAY + 60;
  // calldata = [
  //   oldTreasury.address,
  //   0,
  //   'migrate(address)',
  //   encodeParameters(ethers, ['address'], [newTreasury.address]),
  //   eta,
  // ];
  // txHash = keccak256(
  //   encodeParameters(
  //     ethers,
  //     ['address', 'uint256', 'string', 'bytes', 'uint256'],
  //     calldata
  //   )
  // );


  // console.log(`Tx execution ETA: ${eta}`);

  // if (!(await timelock.connect(operator).queuedTransactions(txHash))) {
  //   throw new Error('wtf');
  // }

  // // 3. transfer operator to new treasury
  // eta = Math.round(new Date().getTime() / 1000) + 2 * DAY + 60;
  // calldata = [
  //   boardroom.address,
  //   0,
  //   'transferOperator(address)',
  //   encodeParameters(ethers, ['address'], [newTreasury.address]),
  //   eta,
  // ];
  // txHash = keccak256(
  //   encodeParameters(
  //     ethers,
  //     ['address', 'uint256', 'string', 'bytes', 'uint256'],
  //     calldata
  //   )
  // );

  // tx = await timelock.connect(operator).queueTransaction(...calldata, override);
  // await wait(
  //   ethers,
  //   tx.hash,
  //   `\n3. timelock.queueTransaction (boardroom.transferOperator) => txHash: ${txHash}`
  // );
  // console.log(`Tx execution ETA: ${eta}`);

  // if (!(await timelock.connect(operator).queuedTransactions(txHash))) {
  //   throw new Error('wtf');
  // }

  // console.log('OK!');

  // console.log('\n===================================================\n');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

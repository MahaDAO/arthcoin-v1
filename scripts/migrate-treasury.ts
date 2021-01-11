import { network, ethers } from 'hardhat';

require('dotenv').config();

import { wait } from './utils';



async function main() {
  // Fetch the provider.
  const { provider } = ethers;

  const estimateGasPrice = await provider.getGasPrice();
  const gasPrice = estimateGasPrice.mul(3).div(2);
  console.log(`Gas Price: ${ethers.utils.formatUnits(gasPrice, 'gwei')} gwei`);
  const override = { gasPrice };

  // Fetch the wallet accounts.
  const [operator, account] = await ethers.getSigners();

  // Fetch already deployed contracts.
  const deployements = require(`../build/deployments.${network.name}.json`);
  
  // Fetch contract factories.
  const Treasury = await ethers.getContractFactory('Treasury');

  // Fetch existing contracts.
  const cash = await ethers.getContractAt('ARTH', deployements.ARTH.address);
  const bond = await ethers.getContractAt('ARTHB', deployements.ARTHB.address);
  const treasury = await ethers.getContractAt('Treasury', deployements.Treasury.address);
  const arthBoardroom = await ethers.getContractAt('ArthBoardroom', deployements.ArthBoardroom.address);
  const arthLiquidityBoardroom = await ethers.getContractAt('ArthLiquidityBoardroom', deployements.ArthBoardroom.address);

  // Deploy new treasury.
  const newTreasury = await Treasury.connect(operator).deploy(
    await treasury.dai(),
    await treasury.cash(),
    await treasury.bond(),
    await treasury.share(),
    await treasury.bondOracle(),
    await treasury.mahausdOracle(),
    await treasury.seigniorageOracle(),
    await treasury.arthLiquidityBoardroom(),
    await treasury.arthBoardroom(),
    await treasury.ecosystemFund(),
    await treasury.uniswapRouter(),
    await treasury.gmuOracle(),
    Math.floor(Date.now() / 1000), // TODO: Replace with .env file key and values.
    5 * 60 // TODO: Replace with .env file key and values.
  );

  const oldCashOperator = await cash.operator();
  const oldBondOperator = await bond.operator();
  const oldArthBoardroomOperator = await arthBoardroom.operator();
  const oldArthLiquidityBoardroomOperator = await arthLiquidityBoardroom.operator();

  // NOTE: In case of mainnet, the ownership of treaury and boardroom and possibly some other smart contracts
  // is with the Timelock smart contract.
  if (network.name !== 'mainnet' && process.env.METAMASK_WALLET) {
    await treasury.connect(account).migrate(newTreasury.address);
    await arthBoardroom.connect(account).transferOperator(newTreasury.address);
    await arthLiquidityBoardroom.connect(account).transferOperator(newTreasury.address);

    console.log(`\nTreasury details: `)
    console.log(` - Old treasury was at address(${treasury.address})`)
    console.log(` - New treasury was at address(${newTreasury.address})`)

    console.log(`\nCash details: `)
    console.log(` - Cash old operator was address(${oldCashOperator})`)
    console.log(` - Cash new operator is at address(${await cash.operator()})`)

    console.log(`\nBond details: `)
    console.log(` - Bond old operator was address(${oldBondOperator})`)
    console.log(` - Bond new operator is at address(${await bond.operator()})`)
  
    console.log(`\nArth boardroom details: `)
    console.log(` - Arth boardroom old operator was address(${oldArthBoardroomOperator})`)
    console.log(` - Arth boardroom new operator is at address(${await arthBoardroom.operator()})`)

    console.log(`\nArth liquidity boardroom details: `)
    console.log(` - Arth liquidity boardroom old operator was address(${oldArthLiquidityBoardroomOperator})`)
    console.log(
      ` - Arth liquidity boardroom new operator is at address(${
        await arthLiquidityBoardroom.operator()
      })`
    )
  } else {
    const timelock = await ethers.getContractAt('Timelock', deployements.Timelock.address);

    const calldatas = [
      {
        desc: 'treasury.migrate',
        calldata: [
          treasury.address,
          0,
          'migrate(address)',
          '0x00000000000000000000000067A883D6F84A2D307D8F587B638E2F172EF2117A',
          Math.floor(Date.now() / 1000),
        ],
      },
      {
        desc: 'arthBoardroom.transferOperator',
        calldata: [
          arthBoardroom.address,
          0,
          'transferOperator(address)',
          '0x0000000000000000000000004E153D084C28F20411D6EA01F7A18E0EC45E19D3',
          Math.floor(Date.now() / 1000),
        ],
      },
      {
        desc: 'arthLiquidityBoardroom.trasnferOperator',
        calldata: [
          arthLiquidityBoardroom.address,
          0,
          'transferOperator(address)',
          '0x00000000000000000000000067A883D6F84A2D307D8F587B638E2F172EF2117A',
          Math.floor(Date.now() / 1000),
        ],
      },
    ];
    
    for await (const queue of calldatas) {
      const tx = await timelock
        .connect(operator)
        .queueTransaction(...queue.calldata, override);
        
      await wait(ethers, tx.hash, `\ntimelock.queueTransaction => ${queue.desc}`);
    }
  }
}


main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
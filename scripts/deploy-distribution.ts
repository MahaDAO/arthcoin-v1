import { network, ethers } from 'hardhat';
import { ParamType, keccak256 } from 'ethers/lib/utils';

import {
  DAI
} from '../deploy.config';
import { arthCommunityPools } from './pools'
import { BigNumber, Contract, ContractFactory } from 'ethers';
const bluebird = require('bluebird')

const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

async function main() {
  console.log('hit', network)
  if (network.name !== 'mainnet') {
    throw new Error('wrong network');
  }

  const [operator] = await ethers.getSigners();

  const MAHADAIARTHLPTokenPool = await ethers.getContractFactory('MAHADAIARTHLPTokenPool')

  const decimals = BigNumber.from(10).pow(18);
  const POOL_START_DATE = Math.floor(new Date("Fri Jan 16 2021 15:00:10 GMT+0000").getTime() / 1000)
  MAHADAIARTHLPTokenPool.connect(operator).deploy(
    '0xb4d930279552397bba2ee473229f89ec245bc365',
    '0x35b6f9e6300aa6c722ea189e096b0b073025806f',
    POOL_START_DATE
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

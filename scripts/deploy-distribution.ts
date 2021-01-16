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
  if (network.name !== 'ropsten') {
    throw new Error('wrong network');
  }

  const [operator] = await ethers.getSigners();

  const ARTH = await ethers.getContractFactory('ARTH');
  const ARTHB = await ethers.getContractFactory('ARTHB');

  // const ARTHMultiTokenPool = await ethers.getContractFactory('ARTHMultiTokenPool');
  const InitialCashDistributor = await ethers.getContractFactory('InitialCashDistributor');

  const ARTHBASPool = await ethers.getContractFactory('ARTHBASPool')
  const ARTHDotPool = await ethers.getContractFactory('ARTHDotPool')
  const ARTHMKRPool = await ethers.getContractFactory('ARTHMKRPool')
  const ARTHSHAREPool = await ethers.getContractFactory('ARTHSHAREPool')
  const ARTHCOMPool = await ethers.getContractFactory('ARTHCOMPool')
  const ARTHESDPool = await ethers.getContractFactory('ARTHESDPool')
  const ARTHMahaEthLPPool = await ethers.getContractFactory('ARTHMahaEthLPPool')
  const ARTHSUSHIPool = await ethers.getContractFactory('ARTHSUSHIPool')
  const ARTHCURVEPool = await ethers.getContractFactory('ARTHCURVEPool')
  const ARTHFRAXPool = await ethers.getContractFactory('ARTHFRAXPool')
  const ARTHMahaPool = await ethers.getContractFactory('ARTHMahaPool')
  const ARTHYFIPool = await ethers.getContractFactory('ARTHYFIPool')
  const ARTHDSDPool = await ethers.getContractFactory('ARTHDSDPool')
  const ARTHMATICPool = await ethers.getContractFactory('ARTHMATICPool')
  const ARTHRSRPool = await ethers.getContractFactory('ARTHRSRPool')

  const communityPools = [
    { d: ARTHBASPool, addrs: '0xbd2f0cd039e0bfcf88901c98c0bfac5ab27566e3'},
    { d: ARTHDotPool, addrs: '0xbd2f0cd039e0bfcf88901c98c0bfac5ab27566e3'},
    { d: ARTHMKRPool, addrs: '0xbd2f0cd039e0bfcf88901c98c0bfac5ab27566e3'},
    { d: ARTHSHAREPool, addrs: '0xbd2f0cd039e0bfcf88901c98c0bfac5ab27566e3'},
    { d: ARTHCOMPool, addrs: '0xbd2f0cd039e0bfcf88901c98c0bfac5ab27566e3'},
    { d: ARTHESDPool, addrs: '0xbd2f0cd039e0bfcf88901c98c0bfac5ab27566e3'},
    { d: ARTHSUSHIPool, addrs: '0xbd2f0cd039e0bfcf88901c98c0bfac5ab27566e3'},
    { d: ARTHCURVEPool, addrs: '0xbd2f0cd039e0bfcf88901c98c0bfac5ab27566e3'},
    { d: ARTHFRAXPool, addrs: '0xbd2f0cd039e0bfcf88901c98c0bfac5ab27566e3'},
    { d: ARTHYFIPool, addrs: '0xbd2f0cd039e0bfcf88901c98c0bfac5ab27566e3'},
    { d: ARTHDSDPool, addrs: '0xbd2f0cd039e0bfcf88901c98c0bfac5ab27566e3'},
    { d: ARTHMATICPool, addrs: '0xbd2f0cd039e0bfcf88901c98c0bfac5ab27566e3'},
    { d: ARTHRSRPool, addrs: '0xbd2f0cd039e0bfcf88901c98c0bfac5ab27566e3'},
  ]
  // create ARTH and ARTHB
  const arth = await ARTH.connect(operator).deploy();
  const arthb = await ARTHB.connect(operator).deploy();

  // get secondary tokens
  const MahaToken = arth
  const MahaEthLPToken = arth

  console.log('arth is at', arth.address)
  console.log('arthb is at', arthb.address)

  // mint 500k + 1 ARTH and 1 ARTHB
  const decimals = BigNumber.from(10).pow(18);
  arth.connect(operator).mint(operator, BigNumber.from(1).mul(decimals));
  arthb.connect(operator).mint(operator, BigNumber.from(1).mul(decimals));

  // deploy distribution contracts
  const POOL_START_DATE = Math.floor(new Date("Fri Jan 15 2021 14:00:10 GMT+0000").getTime() / 1000)
  const tokens = arthCommunityPools.map(m => m.address);
  const tokenAmounts = arthCommunityPools.map(m => BigNumber.from(m.amount).mul(decimals));
  const tokenNames = arthCommunityPools.map(m => m.name);

  console.log('creating pools')
  // const mahaPool = await ARTHMahaPool.connect(operator).deploy(arth.address, MahaToken.address, POOL_START_DATE)
  // const mahaEthPool = await ARTHMahaEthLPPool.connect(operator).deploy(arth.address, MahaEthLPToken.address, POOL_START_DATE)
  // const communityPool = await ARTHMultiTokenPool.connect(operator).deploy(arth.address, POOL_START_DATE)

  const addrs: Contract[] = await bluebird.mapSeries(communityPools, async ({d, addrs: a} :{ d: ContractFactory, addrs: string}) => {
    // console.log(d)
    const ctr = await d.connect(operator).deploy(arth.address, a, POOL_START_DATE);
    console.log('created', ctr)
    return ctr
  })


  console.log(addrs)

  console.log('creating cash distributor')
  const distributor = await InitialCashDistributor.connect(operator).deploy(
    arth.address,
    // pools
    addrs.map(d => d.address),

    // give away 500k ARTH
    BigNumber.from(450000).mul(decimals)
  );

  console.log('registering the following tokens to the community pool', tokenNames.join(', '));

  await bluebird.mapSeries(addrs, async (a: Contract) => {
    await a.connect(operator).setRewardDistribution(distributor.address)
  })
  // await communityPool.connect(operator).registerToken(tokens[0], tokenAmounts[0]);

  console.log('triggering setRewardDistribution')
  // await mahaPool.connect(operator).setRewardDistribution(distributor.address);
  // await mahaEthPool.connect(operator).setRewardDistribution(distributor.address);

  console.log('sending 450k to distributor')
  await arth.connect(operator).mint(distributor.address, decimals.mul(450000));

  console.log('distributing rewards')
  await distributor.connect(operator).distribute();

  // console.log('mahaPool is at ', mahaPool.address)
  // console.log('mahaEthPool is at ', mahaEthPool.address)
  // console.log('communityPool is at ', communityPool.address)
  console.log('distributor is at ', distributor.address)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

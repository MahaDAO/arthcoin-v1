// URL: https://docs.basis.cash/mechanisms/yield-farming
const fs = require('fs');
const path = require('path');


const INITIAL_BAC_FOR_POOLS = 50000;
const INITIAL_BAS_FOR_DAI_BAC = 750000;
const INITIAL_BAS_FOR_DAI_BAS = 250000;


const POOL_START_DATE = Math.floor(Date.now() / 1000);


function distributionPoolContracts() {
  return fs.readdirSync(path.resolve(__dirname, '../contracts/distribution'))
    .filter(filename => filename.endsWith('Pool.sol'))
    .filter(filename => !filename.includes('DAIBASLPTokenSharePool'))
    .filter(filename => filename !== 'BACTOKENPool.sol')
    .map(filename => {
      const filnameWithoutExtension = filename.replace('.sol', '');

      return {
        contractName: filnameWithoutExtension,
        token: filnameWithoutExtension.substring(4, filnameWithoutExtension.length - 4)
      }
    });
}


const bacPools = distributionPoolContracts();


const basPools = {
  DAIBAC: { contractName: 'DAIBACLPTokenSharePool', token: 'DAI_BAC-LPv2' },
  DAIBAS: { contractName: 'DAIBASLPTokenSharePool', token: 'DAI_BAS-LPv2' },
}


module.exports = {
  POOL_START_DATE,
  INITIAL_BAC_FOR_POOLS,
  INITIAL_BAS_FOR_DAI_BAC,
  INITIAL_BAS_FOR_DAI_BAS,
  bacPools,
  basPools,
};

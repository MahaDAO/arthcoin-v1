// URL: https://docs.basis.cash/mechanisms/yield-farming
const fs = require('fs');
const path = require('path');





const POOL_START_DATE = Math.floor(Date.now() / 1000);


function distributionPoolContracts() {
  return fs.readdirSync(path.resolve(__dirname, '../contracts/distribution'))
    .filter(filename => filename.endsWith('Pool.sol'))
    .filter(filename => (
      !filename.includes('DAIMAHALPTokenSharePool') && !filename.includes('DAIARTHLPTokenSharePool'))
    )
    .filter(filename => filename !== 'ARTHTOKENPool.sol')
    .map(filename => {
      const filnameWithoutExtension = filename.replace('.sol', '');

      return {
        contractName: filnameWithoutExtension,
        token: filnameWithoutExtension.substring(4, filnameWithoutExtension.length - 4)
      }
    });
}


const arthPools = distributionPoolContracts();


const mahaPools = {
  DAIARTH: { contractName: 'DAIARTHLPTokenSharePool', token: 'DAI_ARTH-LPv2' },
  DAIMAHA: { contractName: 'DAIMAHALPTokenSharePool', token: 'DAI_MAHA-LPv2' },
}


module.exports = {
  POOL_START_DATE,
  INITIAL_ARTH_FOR_POOLS,
  INITIAL_MAHA_FOR_DAI_ARTH,
  INITIAL_MAHA_FOR_DAI_MAHA,
  arthPools,
  mahaPools,
};

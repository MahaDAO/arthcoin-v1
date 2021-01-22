// https://docs.basis.cash/mechanisms/yield-farming
const INITIAL_BAC_FOR_POOLS = 500000;
const INITIAL_BAS_FOR_DAI_BAC = 750000;
const INITIAL_BAS_FOR_DAI_BAS = 250000;

// const POOL_START_DATE = Date.parse('2020-11-30T00:00:00Z') / 1000;
const POOL_START_DATE = Math.floor(new Date("Sat Jan 16 2021 15:00:10 GMT+0000").getTime() / 1000)
// const POOL_START_DATE = Date.parse('2020-12-25T08:00:00Z') / 1000; // plus 8 hours is our time zone


const bacPools = [
  { contractName: "ARTHBASPool", token: 'BAS' },
  // { contractName: "ARTHMKRPool", token: 'MKR' },
  // { contractName: "ARTHSHAREPool", token: 'SHARE' },
  // { contractName: "ARTHCOMPool", token: 'COMP' },
  // { contractName: "ARTHESDPool", token: 'ESD' },
  // { contractName: "ARTHMahaEthLPPool", token: 'MAHA_ETH_LP' },
  // { contractName: "ARTHSUSHIPool", token: 'SUSHI' },
  // { contractName: "ARTHCURVEPool", token: 'CURVE' },
  // { contractName: "ARTHFRAXPool", token: 'FRAX' },
  // { contractName: "ARTHMahaPool", token: 'MAHA' },
  // { contractName: "ARTHYFIPool", token: 'YFI' },
  // { contractName: "ARTHDSDPool", token: 'DSD' },
  // { contractName: "ARTHMATICPool", token: 'MATIC' },
  // { contractName: "ARTHRSRPool", token: 'RSR' },
];

const basPools = {
  DAIARTH: { contractName: 'DAIARTHLPTokenSharePool', token: 'DAI_ARTH-LPv2' },
  // DAIMIS: { contractName: 'DAIARTHLPTokenSharePool', token: 'ETH_MAHA-LPv2' },
}

module.exports = {
  POOL_START_DATE,
  INITIAL_BAC_FOR_POOLS,
  INITIAL_BAS_FOR_DAI_BAC,
  INITIAL_BAS_FOR_DAI_BAS,
  bacPools,
  basPools,
};

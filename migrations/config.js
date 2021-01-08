const UNIT = 10 ** 18;
const HOUR = 1 * 60 * 60;
const MAX = 1000 * 10 ** 18;
const DAY = 1 * 24 * 60 * 60;


const POOL_START_DATE = Math.floor(Date.now() / 1000);


const TREASURY_PERIOD = 10 * 60;
const ORACLE_PERIOD = 5 * 60;
const BOND_ORACLE_PERIOD = ORACLE_PERIOD;
const SEIGNIORAGE_ORACLE_PERIOD = ORACLE_PERIOD;


// const ORACLE_START_PRICE = web3.utils.toBN(1e18).toString();
// const GMU_ORACLE_START_PRICE = ORACLE_START_PRICE;
// const MAHAUSD_ORACLE_START_PRICE = ORACLE_START_PRICE;


const BOARDROOM_LOCK_DURATION = 5 * 60;
const ARTH_LIQUIDITY_BOARDROOM_LOCK_DURATION = BOARDROOM_LOCK_DURATION;
const ARTH_BOARDROOM_LOCK_DURATION = BOARDROOM_LOCK_DURATION;


const ARTH_LP_TOKEN_POOL_LOCK_AND_DURATION = 5 * 60;
const DAIARTHLPToken_MAHA_POOL_LOCK_DURATION = ARTH_LP_TOKEN_POOL_LOCK_AND_DURATION;

/**
 * List of known (already deployed and verified) contract addresses on here.
 * NOTE: The ropsten token addresses might not be the actual/correct addresses for the 
 * respective token.
 */
const knownContracts = {
  // https://uniswap.org/docs/v2/smart-contracts/factory/#address
  UniswapV2Factory: {
    mainnet: '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f',
    ropsten: '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f',
    rinkeby: '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f',
  },
  UniswapV2Router02: {
    mainnet: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
    ropsten: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
    rinkeby: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
  },
  DAI: {
    mainnet: '0x6b175474e89094c44da98b954eedeac495271d0f',
    ropsten: '0xad6d458402f60fd3bd25163575031acdce07538d',
  },
  SUSD: {
    mainnet: '0x57Ab1E02fEE23774580C119740129eAC7081e9D3',
    ropsten: '0xdd710d668df4d8871468c91c6366458e77ef7c38',
  },
  USDC: {
    mainnet: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    ropsten: '0x70cdfb73f78c51bf8a77b36c911d1f8c305d48e6',
  },
  USDT: {
    mainnet: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    ropsten: '0x6ee856ae55b6e1a249f04cd3b947141bc146273c',
  },
  yCRV: {
    mainnet: '0xdF5e0e81Dff6FAF3A7e52BA697820c5e32D806A8',
    ropsten: '0xface8a2e245d91b90fce1e693d23eee688705025',
  },
  BAL: {
    mainnet: '0xba100000625a3754423978a60c9317c58a424e3d',
    ropsten: '0xc22da04b18b985e9d3d93a6db0e7d6e33ab80641',
  },
  BAS: {
    mainnet: '0xa7ed29b253d8b4e3109ce07c80fc570f81b63696',
    ropsten: '0x22327966a133fa9279b8093271a7953513aae45b',
  },
  BNB: {
    mainnet: '0xB8c77482e45F1F44dE1745F52C74426C631bDD52',
    ropsten: '0xafa53fc5c215f44032001feb73beb4a20ba8bd10',
  },
  BAC: {
    mainnet: '0x3449fc1cd036255ba1eb19d65ff4ba2b8903a69a',
    ropsten: '0x0693a8291edccd6413e2d4c6327ffb5eb41a0259',
  },
  BUSD: {
    mainnet: '0x4fabb145d64652a948d72533023f6e7a623c7c53',
    ropsten: '0x9661b1e30d8b2e686c222dab1db7ef9ebb495ee0',
  },
  COMP: {
    mainnet: '0xc00e94cb662c3520282e6f5717214004a7f26888',
    ropsten: '0x1Fe16De955718CFAb7A44605458AB023838C2793',
  },
  CREAM: {
    mainnet: '0x2ba592f78db6436527729929aaf6c908497cb200',
    ropsten: '0xf9a1578a77e4e76baa38cc02a7b9d49fbd90df5f',
  },
  DOT: {
    // mainnet: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    // ropsten: '0x6ee856ae55b6e1a249f04cd3b947141bc146273c',
  },
  DSD: {
    mainnet: '0xbd2f0cd039e0bfcf88901c98c0bfac5ab27566e3',
    // ropsten: '0x6ee856ae55b6e1a249f04cd3b947141bc146273c',
  },
  ESD: {
    mainnet: '0x36f3fd68e7325a35eb768f1aedaae9ea0689d723',
    ropsten: '0x8da4b92647c7ffeafda80d41799a7cad5a6f12ec',
  },
  FRAX: {
    mainnet: '0x853d955acef822db058eb8505911ed77f175b99e',
    // ropsten: '0x6ee856ae55b6e1a249f04cd3b947141bc146273c',
  },
  FTT: {
    mainnet: '0x50d1c9771902476076ecfc8b2a83ad6b9355a4c9',
    ropsten: '0xb2c5c31d63bf8f8fa05661a3d4f96a3668086322',
  },
  YFI: {
    mainnet: '0x0bc529c00c6401aef6d220be8c6ea1667f6ad93e',
    ropsten: '0x1d6490285bdc40791cb5f93f13e37d233f4e085c',
  },
  HT: {
    mainnet: '0x6f259637dcd74c767781e37bc6133cd6a68aa161',
    ropsten: '0xb1bd0be5dd1287bfb36066eb9caeec42223586aa',
  },
  KCS: {
    mainnet: '0x039b5649a59967e3e936d7471f9c3700100ee1ab',
    // ropsten: '0x6ee856ae55b6e1a249f04cd3b947141bc146273c',
  },
  LEO: {
    mainnet: '0x2af5d2ad76741191d15dfe7bf6ac92d4bd912ca3',
    ropsten: '0x55d4e925f77451063653bc051608933be001f0d6',
  },
  LINK: {
    mainnet: '0x20fe562d797a42dcb3399062ae9546cd06f63280',
    ropsten: '0x6ee856ae55b6e1a249f04cd3b947141bc146273c',
  },
  MAHA: {
    mainnet: '0xb4d930279552397bba2ee473229f89ec245bc365',
    // ropsten: '0x6ee856ae55b6e1a249f04cd3b947141bc146273c',
  },
  MATIC: {
    mainnet: '0x7d1afa7b718fb893db30a3abc0cfc608aacfebb0',
    ropsten: '0x5a4c57941869ca4583bfa143217742bc215d8e1c',
  },
  MIC: {
    mainnet: '0x368b3a58b5f49392e5c9e4c998cb0bb966752e51',
    // ropsten: '0x6ee856ae55b6e1a249f04cd3b947141bc146273c',
  },
  MIS: {
    mainnet: '0x4b4d2e899658fb59b1d518b68fe836b100ee8958',
    // ropsten: '0x6ee856ae55b6e1a249f04cd3b947141bc146273c',
  },
  MKR: {
    mainnet: '0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2',
    ropsten: '0x06732516acd125b6e83c127752ed5f027e1b276e',
  },
  RSR: {
    mainnet: '0x8762db106b2c2a0bccb3a80d1ed41273552616e8',
    ropsten: '0xaee58373b045a5bfc1008ea59b5f307a1338be23',
  },
  SUSHI: {
    mainnet: '0x6b3595068778dd592e39a122f4f5a5cf09c90fe2',
    ropsten: '0xc1171972a56dffeec911de003dbe6c18c08f662a',
  },
};


module.exports = {
  POOL_START_DATE,
  DAY,
  HOUR,
  TREASURY_PERIOD,
  BOND_ORACLE_PERIOD,
  // SEIGNIORAGE_ORACLE_PERIOD,
  // GMU_ORACLE_START_PRICE,
  // MAHAUSD_ORACLE_START_PRICE,
  ARTH_LIQUIDITY_BOARDROOM_LOCK_DURATION,
  ARTH_BOARDROOM_LOCK_DURATION,
  DAIARTHLPToken_MAHA_POOL_LOCK_DURATION,
  knownContracts
};
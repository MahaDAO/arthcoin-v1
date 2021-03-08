import '@nomiclabs/hardhat-ethers';
import '@nomiclabs/hardhat-etherscan';
import 'hardhat-gas-reporter';
import 'solidity-coverage';

require('dotenv').config();
export default {
  default: 'mainnet',
  networks: {
    hardhat: {

    },
    mainnet: {
      url: `https://mainnet.infura.io/v3/69666afe933b4175afe4999170158a5f`,
      accounts: [`0x${process.env.METAMASK_WALLET_SECRET}`],
      gasMultiplier: 1.2,
      gasPrice: 120000000000
    },
    ropsten: {
      url: `https://ropsten.infura.io/v3/69666afe933b4175afe4999170158a5f`,
      accounts: [`0x${process.env.METAMASK_WALLET_SECRET}`]
    },
    goerli: {
      url: `https://goerli.infura.io/v3/69666afe933b4175afe4999170158a5f`,
      accounts: [`0x${process.env.METAMASK_WALLET_SECRET}`]
    },
    development: {
      url: "http://localhost:7545",
      accounts: [process.env.METAMASK_WALLET_SECRET]
    }
  },
  solidity: {
    version: '0.8.0',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  paths: {
    sources: './contracts',
    tests: './test',
    cache: './build/cache',
    artifacts: './build/artifacts',
  },
  gasReporter: {
    currency: 'USD',
    enabled: true,
  },
  etherscan: {
    // Your API key for Etherscan
    // Obtain one at https://etherscan.io/
    apiKey: process.env.ETHERSCAN_API_KEY
  },
};

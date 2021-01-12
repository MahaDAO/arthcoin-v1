HOW TO RUN MIGRATE TREASURY:
================

1. cd <location>/arthcoin-v2
2. yarn
3. Run your ganache (In case of ganache-cli: ganache-cli -p 7545 --networkId 5777)
4. Add 
'''
development: {
    url: "http://localhost:7545",
    accounts: [process.env.WALLET_SECRET_KEY, process.env.METAMASK_WALLET_SECRET]
} 
''' to networks in hardhat.config.ts so that it looks like
'''
networks: {
    hardhat: {},
    development: {
      url: "http://localhost:7545",
      accounts: [process.env.WALLET_SECRET_KEY, process.env.METAMASK_WALLET_SECRET]
    }
  },
'''
4. npx hardhat run scripts/migrate-treasury.ts --network development.
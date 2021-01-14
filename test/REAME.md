HOW TO RUN TESTS:
================

1. cd <location>/arthcoin-v2
2. yarn
3. Run your ganache (In case of ganache-cli: ganache-cli -p 7545 --networkId 5777)
4. truffle migrate --network development --reset
5. yarn test
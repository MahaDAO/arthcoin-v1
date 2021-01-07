const MockDai = artifacts.require('MockDai');
const SeigniorageOracle = artifacts.require('SeigniorageOracle');
const GMUOracle = artifacts.require('GMUOracle');
const Treasury = artifacts.require('Treasury');
const UniswapV2Factory = artifacts.require('UniswapV2Factory');
const ARTH = artifacts.require('ARTH');
const cron = require('node-cron')
const knownContracts = require('../migrations/known-contracts');
// const IERC20 = artifacts.require('IERC20');



/**
 * Main migrations
 */
module.exports = async (callback) => {
    const network = 'ropsten'
    try {
        // const uniswapFactory = network === 'mainnet' || network === 'ropsten'
        //     ? await UniswapV2Factory.at(knownContracts.UniswapV2Factory[network])
        //     : await UniswapV2Factory.deployed()

        // const dai = network === 'mainnet'
        //     ? await IERC20.at(knownContracts.DAI[network])
        //     : await MockDai.deployed();

        // const oracle = await SeigniorageOracle.deployed();

        // const dai_arth_lpt = await oracle.pairFor(uniswapFactory.address, ARTH.address, dai.address);
        // console.log('dai at', dai.address)
        // console.log('arth at', ARTH.address)
        // console.log('dai-arth lp pair at', dai_arth_lpt)

        const gmuOracle = await GMUOracle.deployed();
        const treasury = await Treasury.deployed();

        await gmuOracle.setPrice(web3.utils.toBN(1e18 * 1.9).toString())
        console.log('gmu has been set')
        await treasury.allocateSeigniorage().then(console.log).catch(console.log)

        cron.schedule('*/10 * * * *', async () => {
            console.log('running a task every 10 minute');
            // treasury.getStartTime().then(a => console.log(a.toNumber()))
            treasury.allocateSeigniorage().then(console.log).catch(console.log)
            //     .then(console.log)
            //     .catch(console.log)
            //     .then(callback)
        });


    } catch (error) {
        console.log(error)
    }


    // callback()
}

// truffle run verify ARTHB MahaToken ArthLiquidityBoardroom ArthBoardroom GMUOracle SeigniorageOracle BurnbackFund DevelopmentFund Treasury BACDAIPool BACSUSDPool BACUSDCPool BACUSDTPool BACyCRVPool DAIBACLPTokenSharePool --network ropsten
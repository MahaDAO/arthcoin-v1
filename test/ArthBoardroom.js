const { Contract } = require("ethers");

const ARTHBoardroom = artifacts.require('ARTHBoardroom');
const ARTH = artifacts.require('ARTH');

contract('ARTHBoardroom', async () => {
    let arthBoardroom = null;
    let arth = null;
    
    before('Getting contract', async () => {
        arthBoardroom = await ARTHBoardroom.deployed();

    })

    it('')
});
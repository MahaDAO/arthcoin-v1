// SPDX-License-Identifier: MIT

pragma solidity ^0.6.0;

import '@openzeppelin/contracts/access/Ownable.sol';

import {IMultiUniswapOracle} from '../interfaces/IMultiUniswapOracle.sol';

contract OracleUpdater is Ownable {
    address[] public uniswapOracles;

    event UpdateOracle(address oracle, address updater, uint256 timestamp);

    constructor(address[] memory uniSwapOracles_) public {
        uniswapOracles = uniSwapOracles_;
    }

    function addUniSwapOracle(address uniswapOracle) public onlyOwner {
        uniswapOracles.push(uniswapOracle);
    }

    function getUniSwapOracle(uint256 position) public view returns (address) {
        return uniswapOracles[position];
    }

    function updateOracles() public {
        for (uint256 i = 0; i < uniswapOracles.length; i++) {
            address oracle = uniswapOracles[i];

            try IMultiUniswapOracle(oracle).update() {} catch {}

            emit UpdateOracle(oracle, msg.sender, block.timestamp);
        }
    }
}

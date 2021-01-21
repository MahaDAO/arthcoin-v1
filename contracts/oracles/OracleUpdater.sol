// SPDX-License-Identifier: MIT

pragma solidity ^0.6.12;

import '@openzeppelin/contracts/access/Ownable.sol';

import {Epoch} from '../utils/Epoch.sol';
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

    function removeUniSwapOracle(uint256 position) public onlyOwner {
        uniswapOracles[position] = address(0);
    }

    function getUniSwapOracle(uint256 position) public view returns (address) {
        return uniswapOracles[position];
    }

    function update() public {
        for (uint256 i = 0; i < uniswapOracles.length; i++) {
            address oracle = uniswapOracles[i];

            if (Epoch(oracle).callable() && oracle != address(0)) {
                try IMultiUniswapOracle(oracle).update() {} catch {}

                emit UpdateOracle(oracle, msg.sender, block.timestamp);
            }
        }
    }
}

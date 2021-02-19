// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface IRBAC {
    function refundBond() external;

    function refundCash() external;

    function migrate(address newTreasury) external;

    function setTreasury(address newTreasury) external;

    function mintCash(address account, uint256 amount) external;

    function mintBond(address account, uint256 amount) external;

    function burnCash(address account, uint256 amount) external;

    function burnBond(address account, uint256 amount) external;
}

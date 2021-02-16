// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import '@openzeppelin/contracts/contracts/presets/ERC20PresetMinterPauser.sol';

contract MahaToken is ERC20PresetMinterPauser {
    address public upgradedAddress;
    bool public deprecated;
    string public contactInformation = 'contact@mahadao.com';
    string public reason;
    string public link = 'https://mahadao.com';
    string public url = 'https://mahadao.com';
    string public website = 'https://mahadao.io';

    constructor() ERC20PresetMinterPauser('MahaDAO', 'MAHA') {}
}

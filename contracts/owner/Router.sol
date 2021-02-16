// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import '@openzeppelin/contracts/contracts/GSN/Context.sol';
import '@openzeppelin/contracts/contracts/access/Ownable.sol';

contract Router is Context, Ownable {
    address private _router;

    event RouterTransferred(
        address indexed previousRouter,
        address indexed newRouter
    );

    constructor() {
        _router = _msgSender();
        emit RouterTransferred(address(0), _router);
    }

    function router() public view returns (address) {
        return _router;
    }

    modifier onlyRouter() {
        require(_router == msg.sender, 'router: caller is not the router');
        _;
    }

    function isRouter() public view returns (bool) {
        return _msgSender() == _router;
    }

    function transferRouter(address newRouter_) public onlyOwner {
        _transferRouter(newRouter_);
    }

    function _transferRouter(address newRouter_) internal {
        require(
            newRouter_ != address(0),
            'router: zero address given for new router'
        );

        emit RouterTransferred(address(0), newRouter_);

        _router = newRouter_;
    }
}

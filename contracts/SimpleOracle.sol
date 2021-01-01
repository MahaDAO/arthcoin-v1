pragma solidity ^0.6.0;

import '@openzeppelin/contracts/math/SafeMath.sol';
import '@openzeppelin/contracts/access/Ownable.sol';

import './interfaces/ISimpleOracle.sol';

contract SimpleOracle is Ownable, ISimpleOracle {
    using SafeMath for uint256;

    uint256 public price;

    constructor() public {
        // Set the initial price to 1.05.
        price = uint256(105).mul(1e18).div(100);
    }

    function setPrice(uint256 _price) public override onlyOwner {
        price = _price;
    }

    function getPrice() public view override returns (uint256) {
        return price;
    }

    function consult(uint256 amountIn)
        external
        view
        override
        returns (uint256)
    {
        return price.mul(amountIn).div(1e18);
    }

    event Updated(uint256 price0CumulativeLast, uint256 price1CumulativeLast);
}

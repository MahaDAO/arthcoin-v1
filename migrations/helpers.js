const knownContracts = require('./known-contracts')

const getDAI = async (network, deployer, artifacts) => {
  const MockDai = artifacts.require('MockDai');
  const IERC20 = artifacts.require('IERC20');

  const addr = knownContracts.DAI[network];
  if (addr) return IERC20.at(addr);
  if (MockDai.isDeployed()) return MockDai.deployed();

  console.log(`Deploying mock dai on ${network} network.`);
  await deployer.deploy(MockDai);
  return MockDai.deployed();
};


const getMahaToken = async (network, deployer, artifacts) => {
  const MahaToken = artifacts.require('MahaToken');
  const IERC20 = artifacts.require('IERC20');

  const addr = knownContracts.MahaToken[network];
  if (addr) return IERC20.at(addr);

  if (MahaToken.isDeployed()) return MahaToken.deployed();

  console.log(`Deploying mahatoken on ${network} network.`);
  await deployer.deploy(MahaToken);
  return MahaToken.deployed();
};


const getUniswapFactory = async (network, deployer, artifacts) => {
  const UniswapV2Factory = artifacts.require('UniswapV2Factory');

  const addr  = knownContracts.UniswapV2Factory[network];
  if (addr) return UniswapV2Factory.at(addr);

  if (UniswapV2Factory.isDeployed()) return UniswapV2Factory.deployed();

  console.log(`Deploying uniswap factory on ${network} network.`);
  await deployer.deploy(UniswapV2Factory, '0x0000000000000000000000000000000000000000');
  return UniswapV2Factory.deployed();
};


const getUniswapRouter = async (network, deployer, artifacts) => {
  const UniswapV2Router02 = artifacts.require('UniswapV2Router02');

  const addr  = knownContracts.UniswapV2Router02[network];
  if (addr) return UniswapV2Router02.at(addr);

  if (UniswapV2Router02.isDeployed()) return UniswapV2Router02.deployed();

  console.log(`Deploying uniswap router on ${network} network.`);
  const factory = await getUniswapFactory(network, deployer, artifacts);
  await deployer.deploy(UniswapV2Router02, factory.address, '0x0000000000000000000000000000000000000000');
  return UniswapV2Router02.deployed();
};

const approveIfNot = async (token, spender, amount) => {
  console.log(` - Approving ${token.symbol ? (await token.symbol()) : token.address}`);
  await token.approve(spender, amount);
  console.log(` - Approved ${token.symbol ? (await token.symbol()) : token.address}`);
};


const getPairAddress = async (token1, token2, network, deployer, artifacts) => {
  const factory = await getUniswapFactory(network, deployer, artifacts);
  return await factory.getPair(token1, token2);
}

const isMainnet = (network) => network === 'mainnet' || network === 'bsc' || network === 'matic' || network === 'heco';


module.exports = {
  isMainnet,
  getPairAddress,
  getDAI,
  getMahaToken,
  approveIfNot,
  getUniswapFactory,
  getUniswapRouter
}

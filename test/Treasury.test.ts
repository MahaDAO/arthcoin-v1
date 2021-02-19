import chai, { expect } from 'chai';
import { ethers } from 'hardhat';
import "@nomiclabs/hardhat-ethers";
import { solidity } from 'ethereum-waffle';
import {
  Contract,
  ContractFactory,
  BigNumber,
  utils,
} from 'ethers';
import { Provider } from '@ethersproject/providers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';

import UniswapV2Factory from '@uniswap/v2-core/build/UniswapV2Factory.json';
import UniswapV2Router from '@uniswap/v2-periphery/build/UniswapV2Router02.json';

import { advanceTimeAndBlock } from './shared/utilities';


chai.use(solidity);


const DAY = 86400;
const ETH = utils.parseEther('1');
const ZERO = BigNumber.from(0);
const INITIAL_BAC_AMOUNT = utils.parseEther('50000');
const INITIAL_BAS_AMOUNT = utils.parseEther('10000');
const INITIAL_BAB_AMOUNT = utils.parseEther('50000');


async function latestBlocktime(provider: Provider): Promise<number> {
  const { timestamp } = await provider.getBlock('latest');
  return timestamp;
}


function bigmin(a: BigNumber, b: BigNumber): BigNumber {
  return a.lt(b) ? a : b;
}


describe('Treasury', () => {
  const { provider } = ethers;

  let operator: SignerWithAddress;
  let ant: SignerWithAddress;

  before('provider & accounts setting', async () => {
    [operator, ant] = await ethers.getSigners();
  });

  // Core.
  let ARTHB: ContractFactory;
  let ARTH: ContractFactory;
  let MAHA: ContractFactory;
  let Treasury: ContractFactory;
  let DevelopmentFund: ContractFactory;
  let RainyDayFund: ContractFactory;
  let MockBoardroom: ContractFactory;
  let MockUniswapOracle: ContractFactory;
  let DAI: ContractFactory;
  let period: number = 5 * 60;
  let TreasuryLibrary: ContractFactory;
  let treasuryLibrary: Contract;
  let SimpleOracle: ContractFactory;


  let Factory = new ContractFactory(
    UniswapV2Factory.abi,
    UniswapV2Factory.bytecode
  );
  let Router = new ContractFactory(
    UniswapV2Router.abi,
    UniswapV2Router.bytecode
  );


  before('fetch contract factories', async () => {
    TreasuryLibrary = await ethers.getContractFactory('TreasuryLibrary');

    treasuryLibrary = await TreasuryLibrary.deploy();

    ARTHB = await ethers.getContractFactory('ARTHB');
    ARTH = await ethers.getContractFactory('ARTH');
    MAHA = await ethers.getContractFactory('MahaToken');

    Treasury = await ethers.getContractFactory('Treasury', {
      libraries: {
        TreasuryLibrary: treasuryLibrary.address
      }
    });

    DevelopmentFund = await ethers.getContractFactory('DevelopmentFund');
    RainyDayFund = await ethers.getContractFactory('RainyDayFund')
    MockBoardroom = await ethers.getContractFactory('MockBoardroom');
    MockUniswapOracle = await ethers.getContractFactory('MockUniswapOracle');
    DAI = await ethers.getContractFactory('MockDai');
    SimpleOracle = await ethers.getContractFactory('SimpleOracle');
  });

  let bond: Contract;
  let cash: Contract;
  let share: Contract;
  let dai: Contract;

  let oracle: Contract;
  let arthBoardroom: Contract;
  let arthLiquidityBoardroom: Contract;
  let developmentFund: Contract;
  let gmuOracle: Contract;
  let arthMahaOracle: Contract;
  let treasury: Contract;
  let startTime: BigNumber;
  let uniswap: Contract;
  let uniswapRouter: Contract;
  let mahaLiquidityBoardroom: Contract;
  let rainyDayFund: Contract;
  let arthMahaswapLiquidityBoardroom: Contract;
  let contractionBoardroom1: Contract;
  let contractionBoardroom2: Contract;
  let contractionBoardroom3: Contract;
  let simpleOracle: Contract;

  beforeEach('Deploy contracts', async () => {
    cash = await ARTH.connect(operator).deploy();
    bond = await ARTHB.connect(operator).deploy();
    share = await MAHA.connect(operator).deploy();
    dai = await DAI.connect(operator).deploy();

    startTime = BigNumber.from(await latestBlocktime(provider)).add(DAY);

    uniswap = await Factory.connect(operator).deploy(operator.address);
    uniswapRouter = await Router.connect(operator).deploy(uniswap.address, operator.address);

    await cash.connect(operator).approve(uniswapRouter.address, ETH.mul(10000));
    await share.connect(operator).approve(uniswapRouter.address, ETH.mul(10000));
    await bond.connect(operator).approve(uniswapRouter.address, ETH.mul(10000));
    await dai.connect(operator).approve(uniswapRouter.address, ETH.mul(10000));

    await share.connect(operator).mint(operator.address, ETH.mul(10));
    await dai.connect(operator).mint(operator.address, ETH.mul(10));
    await cash.connect(operator).mint(operator.address, ETH.mul(10));

    await uniswapRouter.connect(operator).addLiquidity(
      cash.address,
      dai.address,
      ETH.mul(10),
      ETH.mul(10),
      ETH.mul(10),
      ETH.mul(10),
      operator.address,
      BigNumber.from(await latestBlocktime(provider)).add(DAY)
    )

    developmentFund = await DevelopmentFund.connect(operator).deploy();
    rainyDayFund = await RainyDayFund.connect(operator).deploy();

    oracle = await MockUniswapOracle.connect(operator).deploy();

    gmuOracle = await MockUniswapOracle.connect(operator).deploy();
    arthMahaOracle = await MockUniswapOracle.connect(operator).deploy();

    arthMahaswapLiquidityBoardroom = await MockBoardroom.connect(operator).deploy(cash.address);
    arthBoardroom = await MockBoardroom.connect(operator).deploy(cash.address);
    mahaLiquidityBoardroom = await MockBoardroom.connect(operator).deploy(cash.address);

    contractionBoardroom1 = await MockBoardroom.connect(operator).deploy(cash.address);
    contractionBoardroom2 = await MockBoardroom.connect(operator).deploy(cash.address);
    contractionBoardroom3 = await MockBoardroom.connect(operator).deploy(cash.address);

    treasury = await Treasury.connect(operator).deploy(
      dai.address,
      cash.address,
      bond.address,
      share.address,
      startTime,
      period,
      0
    );

    await treasury.connect(operator).setAllFunds(
      arthMahaswapLiquidityBoardroom.address,
      mahaLiquidityBoardroom.address,
      arthBoardroom.address,
      contractionBoardroom1.address, // MahaArthMLP
      contractionBoardroom2.address, // MAhaMAHA
      contractionBoardroom3.address, // MahaArth
      developmentFund.address,
      rainyDayFund.address,
    );

    await treasury.connect(operator).setOracles(
      oracle.address,
      oracle.address,
      gmuOracle.address,
      arthMahaOracle.address
    );

    await treasury.setUniswapRouter(
      uniswapRouter.address,
      uniswap.getPair(cash.address, dai.address)
    )

    simpleOracle = await SimpleOracle.deploy('SimpleOracle', ETH);
  });

  let newTreasury: Contract;

  beforeEach('Deploy new treasury', async () => {
    newTreasury = await Treasury.connect(operator).deploy(
      dai.address,
      cash.address,
      bond.address,
      share.address,
      startTime,
      period,
      0
    );

    await newTreasury.connect(operator).setAllFunds(
      arthMahaswapLiquidityBoardroom.address,
      mahaLiquidityBoardroom.address,
      arthBoardroom.address,
      contractionBoardroom1.address, // MahaArthMLP
      contractionBoardroom2.address, // MAhaMAHA
      contractionBoardroom3.address, // MahaArth
      developmentFund.address,
      rainyDayFund.address,
    );

    await newTreasury.connect(operator).setOracles(
      oracle.address,
      oracle.address,
      gmuOracle.address,
      arthMahaOracle.address
    );

    await newTreasury.setUniswapRouter(
      uniswapRouter.address,
      uniswap.getPair(cash.address, dai.address)
    )
  });

  describe('Governance', () => {
    beforeEach('Deploy new treasury', async () => {
      await share.connect(operator).mint(treasury.address, ETH);

      for await (const token of [cash, bond]) {
        await token.connect(operator).mint(treasury.address, ETH);
        await token.connect(operator).transferOperator(treasury.address);
        await token.connect(operator).transferOwnership(treasury.address);
      }

      await arthMahaswapLiquidityBoardroom.connect(operator).transferOperator(treasury.address);
      await arthBoardroom.connect(operator).transferOperator(treasury.address);
      await mahaLiquidityBoardroom.connect(operator).transferOperator(treasury.address);

      await contractionBoardroom1.connect(operator).transferOperator(treasury.address);
      await contractionBoardroom2.connect(operator).transferOperator(treasury.address);
      await contractionBoardroom3.connect(operator).transferOperator(treasury.address);
    });

    describe('#Initialize', () => {
      it('Should works correctly', async () => {
        await treasury.connect(operator).migrate(newTreasury.address);

        await arthMahaswapLiquidityBoardroom.connect(operator).transferOperator(newTreasury.address);
        await arthBoardroom.connect(operator).transferOperator(newTreasury.address);
        await mahaLiquidityBoardroom.connect(operator).transferOperator(newTreasury.address);

        await contractionBoardroom1.connect(operator).transferOperator(newTreasury.address);
        await contractionBoardroom2.connect(operator).transferOperator(newTreasury.address);
        await contractionBoardroom3.connect(operator).transferOperator(newTreasury.address);

        await expect(newTreasury.initialize()).to.emit(
          newTreasury,
          'Initialized'
        );

        const state = await newTreasury.state();
        const accumulatedSeigniorage = state.accumulatedSeigniorage;

        expect(accumulatedSeigniorage).to.eq(ETH);
      });

      it('Should fail if newTreasury is not the operator of core boardroom contracts', async () => {
        await arthBoardroom.connect(operator).transferOperator(ant.address);
        await expect(newTreasury.initialize()).to.revertedWith(
          'Treasury: need more permission'
        );

        await contractionBoardroom1.connect(operator).transferOperator(ant.address);
        await expect(newTreasury.initialize()).to.revertedWith(
          'Treasury: need more permission'
        );

        await contractionBoardroom2.connect(operator).transferOperator(ant.address);
        await expect(newTreasury.initialize()).to.revertedWith(
          'Treasury: need more permission'
        );
        await contractionBoardroom3.connect(operator).transferOperator(ant.address);
        await expect(newTreasury.initialize()).to.revertedWith(
          'Treasury: need more permission'
        );

        await mahaLiquidityBoardroom.connect(operator).transferOperator(ant.address);
        await expect(newTreasury.initialize()).to.revertedWith(
          'Treasury: need more permission'
        );

        await arthMahaswapLiquidityBoardroom.connect(operator).transferOperator(ant.address);
        await expect(newTreasury.initialize()).to.revertedWith(
          'Treasury: need more permission'
        );
      });

      it('Should fail if abuser tries to initialize twice', async () => {
        await treasury.connect(operator).migrate(newTreasury.address);

        await arthMahaswapLiquidityBoardroom.connect(operator).transferOperator(newTreasury.address);
        await arthBoardroom.connect(operator).transferOperator(newTreasury.address);
        await contractionBoardroom1.connect(operator).transferOperator(newTreasury.address);
        await contractionBoardroom2.connect(operator).transferOperator(newTreasury.address);
        await contractionBoardroom3.connect(operator).transferOperator(newTreasury.address);
        await mahaLiquidityBoardroom.connect(operator).transferOperator(newTreasury.address);

        await newTreasury.initialize();
        await expect(newTreasury.initialize()).to.revertedWith(
          '!initialized'
        );
      });
    });

    describe('#Migrate', () => {
      it('Should works correctly', async () => {
        await expect(treasury.connect(operator).migrate(newTreasury.address))
          .to.emit(treasury, 'Migration')
          .withArgs(newTreasury.address);

        for await (const token of [cash, bond]) {
          expect(await token.balanceOf(newTreasury.address)).to.eq(ETH);
          expect(await token.owner()).to.eq(newTreasury.address);
          expect(await token.operator()).to.eq(newTreasury.address);
        }

        expect(await share.balanceOf(newTreasury.address)).to.eq(ETH);
      });

      it('Should fail if treasury is not the operator of core contracts', async () => {
        await arthBoardroom.connect(operator).transferOperator(ant.address);
        await expect(
          treasury.connect(operator).migrate(newTreasury.address)
        ).to.revertedWith('Treasury: need more permission');

        await contractionBoardroom1.connect(operator).transferOperator(ant.address);
        await expect(
          treasury.connect(operator).migrate(newTreasury.address)
        ).to.revertedWith('Treasury: need more permission');

        await contractionBoardroom2.connect(operator).transferOperator(ant.address);
        await expect(
          treasury.connect(operator).migrate(newTreasury.address)
        ).to.revertedWith('Treasury: need more permission');

        await contractionBoardroom3.connect(operator).transferOperator(ant.address);
        await expect(
          treasury.connect(operator).migrate(newTreasury.address)
        ).to.revertedWith('Treasury: need more permission');

        await mahaLiquidityBoardroom.connect(operator).transferOperator(ant.address);
        await expect(
          treasury.connect(operator).migrate(newTreasury.address)
        ).to.revertedWith('Treasury: need more permission');

        await arthMahaswapLiquidityBoardroom.connect(operator).transferOperator(ant.address);
        await expect(
          treasury.connect(operator).migrate(newTreasury.address)
        ).to.revertedWith('Treasury: need more permission');
      });

      it('should fail if already migrated', async () => {
        await treasury.connect(operator).migrate(newTreasury.address);
        await arthMahaswapLiquidityBoardroom.connect(operator).transferOperator(newTreasury.address);
        await arthBoardroom.connect(operator).transferOperator(newTreasury.address);
        await contractionBoardroom1.connect(operator).transferOperator(newTreasury.address);
        await contractionBoardroom2.connect(operator).transferOperator(newTreasury.address);
        await contractionBoardroom3.connect(operator).transferOperator(newTreasury.address);
        await mahaLiquidityBoardroom.connect(operator).transferOperator(newTreasury.address);

        await newTreasury.connect(operator).migrate(treasury.address);
        await arthMahaswapLiquidityBoardroom.connect(operator).transferOperator(treasury.address);
        await arthBoardroom.connect(operator).transferOperator(treasury.address);
        await contractionBoardroom1.connect(operator).transferOperator(treasury.address);
        await contractionBoardroom2.connect(operator).transferOperator(treasury.address);
        await contractionBoardroom3.connect(operator).transferOperator(treasury.address);
        await mahaLiquidityBoardroom.connect(operator).transferOperator(treasury.address);

        await expect(
          treasury.connect(operator).migrate(newTreasury.address)
        ).to.revertedWith('!migrated');
      });
    });
  });

  describe('Seigniorage', () => {
    describe('#allocateSeigniorage', () => {
      beforeEach('transfer permissions', async () => {
        await bond.mint(operator.address, INITIAL_BAB_AMOUNT);
        await cash.mint(operator.address, INITIAL_BAC_AMOUNT);
        await cash.mint(treasury.address, INITIAL_BAC_AMOUNT);
        await share.mint(operator.address, INITIAL_BAS_AMOUNT);
        await share.mint(treasury.address, INITIAL_BAS_AMOUNT);

        await treasury.connect(operator.address).setContractionRewardPerMonth(INITIAL_BAB_AMOUNT.div(1000));

        for await (const contract of [
          cash, bond, arthMahaswapLiquidityBoardroom,
          contractionBoardroom1, arthBoardroom, mahaLiquidityBoardroom,
          contractionBoardroom2, contractionBoardroom3]) {
          await contract.connect(operator).transferOperator(treasury.address);
        }
      });

      describe('after migration', () => {
        it('should fail if contract migrated', async () => {
          for await (const contract of [cash, bond]) {
            await contract
              .connect(operator)
              .transferOwnership(treasury.address);
          }

          await treasury.connect(operator).migrate(operator.address);

          const flags = await treasury.flags();
          const migrated = flags.migrated;

          expect(migrated).to.be.true;

          await expect(treasury.allocateSeigniorage()).to.revertedWith(
            'Treasury: migrated'
          );
        });
      });

      describe('before startTime', () => {
        it('should fail if not started yet', async () => {
          await expect(treasury.allocateSeigniorage()).to.revertedWith(
            'Epoch: not started yet'
          );
        });
      });

      describe('after startTime', () => {
        beforeEach('advance blocktime', async () => {
          // Wait til first epoch.
          await advanceTimeAndBlock(
            provider,
            startTime.sub(await latestBlocktime(provider)).toNumber()
          );
        });

        it('should fund contraction boardrooms if price < targetPrice and price > bondPurchasePrice', async () => {
          const cashPrice = ETH.mul(98).div(100);
          await oracle.setPrice(cashPrice);

          const oldCashSupply = await cash.totalSupply();
          const oldCashBalanceOfAnt = await cash.balanceOf(ant.address);
          const oldCashBalanceOfTreasury = await cash.balanceOf(treasury.address);

          const contractionRewardPerEpoch = BigNumber.from((await treasury.state()).contractionRewardPerEpoch.toString());

          const rewardToGive = bigmin(
            await share.balanceOf(treasury.address),
            contractionRewardPerEpoch
          )

          console.log(rewardToGive.toString())

          const expectedArthBoardroomReserve = rewardToGive.mul(BigNumber.from((await treasury.boardroomState()).arthAllocationRate.toString())).div(100);
          const expectedMahaLiqBoardroomRes = rewardToGive.mul(BigNumber.from((await treasury.boardroomState()).mahaAllocationRate.toString())).div(100);
          const expectedArthMahaswapLiqBoardRes = rewardToGive.mul(BigNumber.from((await treasury.boardroomState()).arthLiquidityMlpAllocationRate.toString())).div(100);

          await expect(treasury.connect(ant).allocateSeigniorage()).to.not.emit(treasury, 'TreasuryFunded')

          expect(await cash.totalSupply()).to.eq(oldCashSupply.add(ETH.mul(300)));
          expect(await cash.balanceOf(ant.address)).to.eq(oldCashBalanceOfAnt.add(ETH.mul(300)));
          expect(await cash.balanceOf(treasury.address)).to.eq(oldCashBalanceOfTreasury);

          expect(await cash.balanceOf(arthBoardroom.address)).to.eq(
            0
          );
          expect(await cash.balanceOf(arthMahaswapLiquidityBoardroom.address)).to.eq(
            0
          );
          expect(await cash.balanceOf(mahaLiquidityBoardroom.address)).to.eq(
            0
          );
          expect(await share.balanceOf(arthBoardroom.address)).to.eq(
            0
          );
          expect(await share.balanceOf(arthMahaswapLiquidityBoardroom.address)).to.eq(
            0
          );
          expect(await share.balanceOf(mahaLiquidityBoardroom.address)).to.eq(
            0
          );
          expect(await cash.balanceOf(contractionBoardroom1.address)).to.eq(
            0
          );
          expect(await cash.balanceOf(contractionBoardroom2.address)).to.eq(
            0
          );
          expect(await cash.balanceOf(contractionBoardroom3.address)).to.eq(
            0
          );

          expect(await share.balanceOf(contractionBoardroom1.address)).to.eq(
            expectedArthMahaswapLiqBoardRes
          );
          expect(await share.balanceOf(contractionBoardroom2.address)).to.eq(
            expectedMahaLiqBoardroomRes
          );
          expect(await share.balanceOf(contractionBoardroom3.address)).to.eq(
            expectedArthBoardroomReserve
          );
        });

        it('should fund contraction boardrooms if price < targetPrice and price > bondPurchasePrice', async () => {
          const cashPrice = ETH.mul(98).div(100);
          await oracle.setPrice(cashPrice);

          const oldCashSupply = await cash.totalSupply();
          const oldCashBalanceOfAnt = await cash.balanceOf(ant.address);
          const oldCashBalanceOfTreasury = await cash.balanceOf(treasury.address);

          const contractionRewardPerEpoch = BigNumber.from((await treasury.state()).contractionRewardPerEpoch.toString());

          const rewardToGive = bigmin(
            await share.balanceOf(treasury.address),
            contractionRewardPerEpoch
          )

          const expectedArthBoardroomReserve = rewardToGive.mul(BigNumber.from((await treasury.boardroomState()).arthAllocationRate.toString())).div(100);
          const expectedMahaLiqBoardroomRes = rewardToGive.mul(BigNumber.from((await treasury.boardroomState()).mahaAllocationRate.toString())).div(100);
          const expectedArthMahaswapLiqBoardRes = rewardToGive.mul(BigNumber.from((await treasury.boardroomState()).arthLiquidityMlpAllocationRate.toString())).div(100);

          await expect(treasury.connect(ant).allocateSeigniorage()).to.not.emit(treasury, 'TreasuryFunded')

          expect(await cash.totalSupply()).to.eq(oldCashSupply.add(ETH.mul(300)));
          expect(await cash.balanceOf(ant.address)).to.eq(oldCashBalanceOfAnt.add(ETH.mul(300)));
          expect(await cash.balanceOf(treasury.address)).to.eq(oldCashBalanceOfTreasury);


          expect(await cash.balanceOf(arthBoardroom.address)).to.eq(
            0
          );
          expect(await cash.balanceOf(arthMahaswapLiquidityBoardroom.address)).to.eq(
            0
          );
          expect(await cash.balanceOf(mahaLiquidityBoardroom.address)).to.eq(
            0
          );
          expect(await share.balanceOf(arthBoardroom.address)).to.eq(
            0
          );
          expect(await share.balanceOf(arthMahaswapLiquidityBoardroom.address)).to.eq(
            0
          );
          expect(await share.balanceOf(mahaLiquidityBoardroom.address)).to.eq(
            0
          );
          expect(await cash.balanceOf(contractionBoardroom1.address)).to.eq(
            0
          );
          expect(await cash.balanceOf(contractionBoardroom2.address)).to.eq(
            0
          );
          expect(await cash.balanceOf(contractionBoardroom3.address)).to.eq(
            0
          );

          expect(await share.balanceOf(contractionBoardroom1.address)).to.eq(
            expectedArthMahaswapLiqBoardRes
          );
          expect(await share.balanceOf(contractionBoardroom2.address)).to.eq(
            expectedMahaLiqBoardroomRes
          );
          expect(await share.balanceOf(contractionBoardroom3.address)).to.eq(
            expectedArthBoardroomReserve
          );
        });

        it('should not fund expansion boardrooms if price < targetPrice and price > bondPurchasePrice', async () => {
          const cashPrice = ETH.mul(98).div(100);
          await oracle.setPrice(cashPrice);

          const oldCashSupply = await cash.totalSupply();
          const oldCashBalanceOfAnt = await cash.balanceOf(ant.address);
          const oldCashBalanceOfTreasury = await cash.balanceOf(treasury.address);

          await expect(treasury.connect(ant).allocateSeigniorage()).to.not.emit(treasury, 'TreasuryFunded')

          expect(await cash.totalSupply()).to.eq(oldCashSupply.add(ETH.mul(300)));
          expect(await cash.balanceOf(ant.address)).to.eq(oldCashBalanceOfAnt.add(ETH.mul(300)));
          expect(await cash.balanceOf(treasury.address)).to.eq(oldCashBalanceOfTreasury);

          expect(await cash.balanceOf(arthBoardroom.address)).to.eq(
            0
          );
          expect(await cash.balanceOf(arthMahaswapLiquidityBoardroom.address)).to.eq(
            0
          );
          expect(await cash.balanceOf(mahaLiquidityBoardroom.address)).to.eq(
            0
          );
          expect(await share.balanceOf(arthBoardroom.address)).to.eq(
            0
          );
          expect(await share.balanceOf(arthMahaswapLiquidityBoardroom.address)).to.eq(
            0
          );
          expect(await share.balanceOf(mahaLiquidityBoardroom.address)).to.eq(
            0
          );
          expect(await cash.balanceOf(contractionBoardroom1.address)).to.eq(
            0
          );
          expect(await cash.balanceOf(contractionBoardroom2.address)).to.eq(
            0
          );
          expect(await cash.balanceOf(contractionBoardroom3.address)).to.eq(
            0
          );
          expect(await share.balanceOf(contractionBoardroom1.address)).to.gt(
            0
          );
          expect(await share.balanceOf(contractionBoardroom2.address)).to.gt(
            0
          );
          expect(await share.balanceOf(contractionBoardroom3.address)).to.gt(
            0
          );
        });

        it('should not fund expansion boardrooms if price < targetPrice and price < bondPurchasePrice', async () => {
          const cashPrice = ETH.mul(90).div(100);
          await oracle.setPrice(cashPrice);

          const oldCashSupply = await cash.totalSupply();
          const oldCashBalanceOfAnt = await cash.balanceOf(ant.address);
          const oldCashBalanceOfTreasury = await cash.balanceOf(treasury.address);

          await expect(treasury.connect(ant).allocateSeigniorage()).to.not.emit(treasury, 'TreasuryFunded')

          expect(await cash.totalSupply()).to.eq(oldCashSupply.add(ETH.mul(300)));
          expect(await cash.balanceOf(ant.address)).to.eq(oldCashBalanceOfAnt.add(ETH.mul(300)));
          expect(await cash.balanceOf(treasury.address)).to.eq(oldCashBalanceOfTreasury);

          expect(await cash.balanceOf(arthBoardroom.address)).to.eq(
            0
          );
          expect(await cash.balanceOf(arthMahaswapLiquidityBoardroom.address)).to.eq(
            0
          );
          expect(await cash.balanceOf(mahaLiquidityBoardroom.address)).to.eq(
            0
          );
          expect(await share.balanceOf(arthBoardroom.address)).to.eq(
            0
          );
          expect(await share.balanceOf(arthMahaswapLiquidityBoardroom.address)).to.eq(
            0
          );
          expect(await share.balanceOf(mahaLiquidityBoardroom.address)).to.eq(
            0
          );
          expect(await cash.balanceOf(contractionBoardroom1.address)).to.eq(
            0
          );
          expect(await cash.balanceOf(contractionBoardroom2.address)).to.eq(
            0
          );
          expect(await cash.balanceOf(contractionBoardroom3.address)).to.eq(
            0
          );
          expect(await share.balanceOf(contractionBoardroom1.address)).to.gt(
            0
          );
          expect(await share.balanceOf(contractionBoardroom2.address)).to.gt(
            0
          );
          expect(await share.balanceOf(contractionBoardroom3.address)).to.gt(
            0
          );
        });

        it('should fund all expansion boardrooms & funds if price > targetPrice and price > expansionpriceLimit', async () => {
          const cashPrice = ETH.mul(200).div(100);
          await oracle.setPrice(cashPrice);

          const oldCashBalanceOfAnt = await cash.balanceOf(ant.address);

          const treasuryHoldings = BigNumber.from((await treasury.state()).accumulatedSeigniorage.toString());

          // calculate with circulating supply without considering uniswap liq.
          const cashSupply = (await cash.totalSupply()).sub(treasuryHoldings).add(ETH.mul(300));

          const percentage = bigmin(
            cashPrice.sub(ETH).mul(ETH).div(ETH).div(100),
            BigNumber.from((await treasury.state()).maxSupplyIncreasePerEpoch.toString())
          );

          let expectedSeigniorage = cashSupply
            .mul(percentage)
            .div(100);
          const mintedSeigniorage = expectedSeigniorage;

          // get all expected reserve
          const expectedFundReserve = expectedSeigniorage
            .mul(BigNumber.from((await treasury.boardroomState()).ecosystemFundAllocationRate.toString()))
            .div(100);

          expectedSeigniorage = expectedSeigniorage.sub(expectedFundReserve)

          const expectedRainyDayReserve = mintedSeigniorage
            .mul(BigNumber.from((await treasury.boardroomState()).rainyDayFundAllocationRate.toString()))
            .div(100);
          expectedSeigniorage = expectedSeigniorage.sub(expectedRainyDayReserve)

          const expectedTreasuryReserve = bigmin(
            expectedSeigniorage.mul(BigNumber.from((await treasury.state()).bondSeigniorageRate.toString())).div(100),
            BigNumber.from((await bond.totalSupply()).sub(treasuryHoldings).toString())
          );

          expectedSeigniorage = expectedSeigniorage.sub(expectedTreasuryReserve);

          const expectedArthBoardroomReserve = expectedSeigniorage.mul(BigNumber.from((await treasury.boardroomState()).arthAllocationRate.toString())).div(100);
          const expectedMahaLiqBoardroomRes = expectedSeigniorage.mul(BigNumber.from((await treasury.boardroomState()).mahaAllocationRate.toString())).div(100);
          const expectedArthMahaswapLiqBoardRes = expectedSeigniorage.mul(BigNumber.from((await treasury.boardroomState()).arthLiquidityMlpAllocationRate.toString())).div(100);

          const allocationResult = await treasury.connect(ant).allocateSeigniorage();

          if (expectedSeigniorage.gt(ZERO)) {
            await expect(new Promise((resolve) => resolve(allocationResult)))
              .to.emit(treasury, 'SeigniorageMinted')
              .withArgs(mintedSeigniorage);
          }

          if (expectedFundReserve.gt(ZERO)) {
            await expect(new Promise((resolve) => resolve(allocationResult)))
              .to.emit(treasury, 'PoolFunded')
          }

          if (expectedRainyDayReserve.gt(ZERO)) {
            await expect(new Promise((resolve) => resolve(allocationResult)))
              .to.emit(treasury, 'PoolFunded')
          }

          if (expectedTreasuryReserve.gt(ZERO)) {
            await expect(new Promise((resolve) => resolve(allocationResult)))
              .to.emit(treasury, 'TreasuryFunded')
              .withArgs(
                await latestBlocktime(provider),
                expectedTreasuryReserve
              );
          }

          if (expectedArthBoardroomReserve.gt(ZERO)) {
            await expect(new Promise((resolve) => resolve(allocationResult)))
              .to.emit(treasury, 'PoolFunded')
          }

          if (expectedArthMahaswapLiqBoardRes.gt(ZERO)) {
            await expect(new Promise((resolve) => resolve(allocationResult)))
              .to.emit(treasury, 'PoolFunded')
          }

          if (expectedMahaLiqBoardroomRes.gt(ZERO)) {
            await expect(new Promise((resolve) => resolve(allocationResult)))
              .to.emit(treasury, 'PoolFunded')
          }
          expect(await cash.balanceOf(developmentFund.address)).to.eq(expectedFundReserve);
          expect(await cash.balanceOf(rainyDayFund.address)).to.eq(expectedFundReserve);

          expect(
            BigNumber.from((await treasury.state()).accumulatedSeigniorage.toString())
          ).to.eq(expectedTreasuryReserve);

          expect(await cash.balanceOf(arthBoardroom.address)).to.eq(
            expectedArthBoardroomReserve
          );
          expect(await cash.balanceOf(arthMahaswapLiquidityBoardroom.address)).to.eq(
            expectedArthMahaswapLiqBoardRes
          );
          expect(await cash.balanceOf(mahaLiquidityBoardroom.address)).to.eq(
            expectedMahaLiqBoardroomRes
          );
          expect(await cash.balanceOf(ant.address)).to.eq(oldCashBalanceOfAnt.add(ETH.mul(300)));

          expect(await share.balanceOf(arthBoardroom.address)).to.eq(
            0
          );
          expect(await share.balanceOf(arthMahaswapLiquidityBoardroom.address)).to.eq(
            0
          );
          expect(await share.balanceOf(mahaLiquidityBoardroom.address)).to.eq(
            0
          );
          expect(await cash.balanceOf(contractionBoardroom1.address)).to.eq(
            0
          );
          expect(await cash.balanceOf(contractionBoardroom2.address)).to.eq(
            0
          );
          expect(await cash.balanceOf(contractionBoardroom3.address)).to.eq(
            0
          );
          expect(await share.balanceOf(contractionBoardroom1.address)).to.eq(
            0
          );
          expect(await share.balanceOf(contractionBoardroom2.address)).to.eq(
            0
          );
          expect(await share.balanceOf(contractionBoardroom3.address)).to.eq(
            0
          );
        });

        it('should fund only treasury if price > targetPrice and price < expansionLimitPrice with 10% bonds & surprise=false', async () => {
          const cashPrice = ETH.mul(103).div(100);
          await oracle.setPrice(cashPrice);

          expect((await bond.totalSupply()).eq(INITIAL_BAB_AMOUNT))

          const oldCashSupply = await cash.totalSupply();
          const oldCashBalanceOfTreasury = await cash.balanceOf(treasury.address);

          // calculate with circulating supply without considering uniswap liq.
          const treasuryHoldings = BigNumber.from((await treasury.state()).accumulatedSeigniorage.toString());

          const cashSupply = (await cash.totalSupply()).sub(treasuryHoldings).add(ETH.mul(300));

          const percentage = bigmin(
            cashPrice.sub(ETH).mul(100).div(ETH),
            BigNumber.from((await treasury.state()).maxSupplyIncreasePerEpoch.toString())
          );

          let seigniorageToMint = cashSupply
            .mul(percentage)
            .div(100);

          const seigniorage = await treasury.estimateSeignorageToMint(cashPrice); // all are same oracle.
          const finalSeigniorageToMint = bigmin(
            seigniorageToMint,
            (await bond.totalSupply()).sub(treasuryHoldings)
          );

          expect(seigniorage.eq(finalSeigniorageToMint))

          // TODO: check emit for all respective events.
          await expect(treasury.connect(ant).allocateSeigniorage())
            .to.emit(treasury, 'SeigniorageMinted')
            .to.emit(treasury, 'TreasuryFunded')
            .to.not.emit(treasury, 'PoolFunded');


          expect(await cash.totalSupply()).to.eq(oldCashSupply.add(ETH.mul(300).add(finalSeigniorageToMint)));
          expect(await cash.balanceOf(ant.address)).to.eq(ETH.mul(300)); // 200 ARTH bonus
          expect(await cash.balanceOf(treasury.address)).to.eq(oldCashBalanceOfTreasury.add(finalSeigniorageToMint));
          expect(await cash.balanceOf(developmentFund.address)).to.eq(0);
          expect(await cash.balanceOf(rainyDayFund.address)).to.eq(0);
          expect(await cash.balanceOf(arthBoardroom.address)).to.eq(
            0
          );
          expect(await cash.balanceOf(arthMahaswapLiquidityBoardroom.address)).to.eq(
            0
          );
          expect(await cash.balanceOf(mahaLiquidityBoardroom.address)).to.eq(
            0
          );

          expect(await share.balanceOf(arthBoardroom.address)).to.eq(
            0
          );
          expect(await share.balanceOf(arthMahaswapLiquidityBoardroom.address)).to.eq(
            0
          );
          expect(await share.balanceOf(mahaLiquidityBoardroom.address)).to.eq(
            0
          );
          expect(await cash.balanceOf(contractionBoardroom1.address)).to.eq(
            0
          );
          expect(await cash.balanceOf(contractionBoardroom2.address)).to.eq(
            0
          );
          expect(await cash.balanceOf(contractionBoardroom3.address)).to.eq(
            0
          );
          expect(await share.balanceOf(contractionBoardroom1.address)).to.eq(
            0
          );
          expect(await share.balanceOf(contractionBoardroom2.address)).to.eq(
            0
          );
          expect(await share.balanceOf(contractionBoardroom3.address)).to.eq(
            0
          );
        });

        it('should fund only treasury and expansion boardrooms if price > targetPrice and price < expansionLimitPrice with 10% bonds & surprise=true', async () => {
          const cashPrice = ETH.mul(103).div(100);
          await oracle.setPrice(cashPrice);

          // await bond.mint(operator.address, INITIAL_BAB_AMOUNT);
          expect((await bond.totalSupply()).eq(INITIAL_BAB_AMOUNT))

          await treasury.connect(operator).setSurprise(true);

          const oldCashSupply = await cash.totalSupply();
          const oldCashBalanceOfTreasury = await cash.balanceOf(treasury.address);

          // calculate with circulating supply without considering uniswap liq.
          const treasuryHoldings = BigNumber.from((await treasury.state()).accumulatedSeigniorage.toString());
          const cashSupply = (await cash.totalSupply()).sub(treasuryHoldings).add(ETH.mul(300));

          const percentage = bigmin(
            cashPrice.sub(ETH).mul(100).div(ETH),
            BigNumber.from((await treasury.state()).maxSupplyIncreasePerEpoch.toString())
          );

          let seigniorageToMint = cashSupply
            .mul(percentage)
            .div(100);

          const seigniorage = await treasury.estimateSeignorageToMint(cashPrice); // all are same oracle.

          const finalSeigniorageToMint = bigmin(
            seigniorageToMint,
            (await bond.totalSupply()).sub(treasuryHoldings)
          );

          expect(seigniorage.eq(finalSeigniorageToMint))

          const expectedTreasuryReserve = bigmin(
            finalSeigniorageToMint.mul(90).div(100),
            (await bond.totalSupply()).sub(treasuryHoldings)
          );
          const expectedSeignorageForAllBoardrooms = finalSeigniorageToMint.mul(10).div(100);

          const expectedArthBoardroomReserve = expectedSeignorageForAllBoardrooms.mul(BigNumber.from((await treasury.boardroomState()).arthAllocationRate.toString())).div(100);
          const expectedMahaLiqBoardroomRes = expectedSeignorageForAllBoardrooms.mul(BigNumber.from((await treasury.boardroomState()).mahaAllocationRate.toString())).div(100);
          const expectedArthMahaswapLiqBoardRes = expectedSeignorageForAllBoardrooms.mul(BigNumber.from((await treasury.boardroomState()).arthLiquidityMlpAllocationRate.toString())).div(100);

          // TODO: check emit for all respective events.
          await expect(treasury.connect(ant).allocateSeigniorage())
            .to.emit(treasury, 'SeigniorageMinted')
            .to.emit(treasury, 'TreasuryFunded')
            .withArgs(
              await latestBlocktime(provider),
              expectedTreasuryReserve
            )
            .to.emit(treasury, 'PoolFunded');

          expect(await cash.balanceOf(developmentFund.address)).to.eq(0);
          expect(await cash.balanceOf(rainyDayFund.address)).to.eq(0);
          expect(await cash.totalSupply()).to.eq(oldCashSupply.add(ETH.mul(300).add(finalSeigniorageToMint)));
          expect(await cash.balanceOf(ant.address)).to.eq(ETH.mul(300)); // 200 ARTH bonus
          expect(await cash.balanceOf(treasury.address)).to.eq(oldCashBalanceOfTreasury.add(expectedTreasuryReserve));
          expect(await cash.balanceOf(arthBoardroom.address)).to.eq(
            expectedArthBoardroomReserve
          );
          expect(await cash.balanceOf(arthMahaswapLiquidityBoardroom.address)).to.eq(
            expectedArthMahaswapLiqBoardRes
          );
          expect(await cash.balanceOf(mahaLiquidityBoardroom.address)).to.eq(
            expectedMahaLiqBoardroomRes
          );
          expect(await share.balanceOf(arthBoardroom.address)).to.eq(
            0
          );
          expect(await share.balanceOf(arthMahaswapLiquidityBoardroom.address)).to.eq(
            0
          );
          expect(await share.balanceOf(mahaLiquidityBoardroom.address)).to.eq(
            0
          );
          expect(await cash.balanceOf(contractionBoardroom1.address)).to.eq(
            0
          );
          expect(await cash.balanceOf(contractionBoardroom2.address)).to.eq(
            0
          );
          expect(await cash.balanceOf(contractionBoardroom3.address)).to.eq(
            0
          );
          expect(await share.balanceOf(contractionBoardroom1.address)).to.eq(
            0
          );
          expect(await share.balanceOf(contractionBoardroom2.address)).to.eq(
            0
          );
          expect(await share.balanceOf(contractionBoardroom3.address)).to.eq(
            0
          );
        });

        it('should move to next epoch after allocation', async () => {
          const cashPrice1 = ETH.mul(106).div(100);
          await oracle.setPrice(cashPrice1);

          expect(await treasury.getNextEpoch()).to.eq(0);
          expect(await treasury.getLastEpoch()).to.eq(0);
          expect(await treasury.nextEpochPoint()).to.eq(startTime);

          await treasury.allocateSeigniorage();
          expect(await treasury.getNextEpoch()).to.eq(1);
          expect(await treasury.getLastEpoch()).to.eq(0);
          // expect(await treasury.nextEpochPoint()).to.eq(startTime.add(treasury.getPeriod()));

          await advanceTimeAndBlock(
            provider,
            Number(await treasury.nextEpochPoint()) -
            (await latestBlocktime(provider))
          );

          const cashPrice2 = ETH.mul(104).div(100);
          await oracle.setPrice(cashPrice2);

          await treasury.allocateSeigniorage();
          expect(await treasury.getNextEpoch()).to.eq(2);
          expect(await treasury.getLastEpoch()).to.eq(1);

          // TODO: uncomment this and get this to work
          // expect(await treasury.nextEpochPoint()).to.eq(startTime.add(treasury.getPeriod() * 2));
        });

        describe('should fail', () => {
          it('if treasury is not the operator of core contract', async () => {
            const cashPrice = ETH.mul(106).div(100);
            await oracle.setPrice(cashPrice);
            await oracle.setEpoch(1);

            for await (const target of [cash, bond, arthMahaswapLiquidityBoardroom, arthBoardroom, contractionBoardroom1, contractionBoardroom2, contractionBoardroom3, mahaLiquidityBoardroom]) {
              await target.connect(operator).transferOperator(ant.address);
              await expect(treasury.allocateSeigniorage()).to.revertedWith(
                'Treasury: need more permission'
              );
            }
          });

          it('if seigniorage already allocated in this epoch', async () => {
            const cashPrice = ETH.mul(106).div(100);
            await oracle.setPrice(cashPrice);
            await oracle.setEpoch(1);

            await treasury.allocateSeigniorage();
            await expect(treasury.allocateSeigniorage()).to.revertedWith(
              'Epoch: not allowed'
            );
          });
        });
      });
    });

    describe('#allocateSeigniorage without bonds', () => {
      beforeEach('transfer permissions', async () => {
        await cash.mint(operator.address, INITIAL_BAC_AMOUNT);
        await cash.mint(treasury.address, INITIAL_BAC_AMOUNT);
        await share.mint(operator.address, INITIAL_BAS_AMOUNT);
        for await (const contract of [
          cash, bond, arthMahaswapLiquidityBoardroom,
          contractionBoardroom1, arthBoardroom, mahaLiquidityBoardroom,
          contractionBoardroom2, contractionBoardroom3]) {
          await contract.connect(operator).transferOperator(treasury.address);
        }
      });

      describe('after migration', () => {
        it('should fail if contract migrated', async () => {
          for await (const contract of [cash, bond]) {
            await contract
              .connect(operator)
              .transferOwnership(treasury.address);
          }

          await treasury.connect(operator).migrate(operator.address);

          const flags = await treasury.flags();
          const migrated = flags.migrated;

          expect(migrated).to.be.true;

          await expect(treasury.allocateSeigniorage()).to.revertedWith(
            'Treasury: migrated'
          );
        });
      });

      describe('before startTime', () => {
        it('should fail if not started yet', async () => {
          await expect(treasury.allocateSeigniorage()).to.revertedWith(
            'Epoch: not started yet'
          );
        });
      });

      describe('after startTime', () => {
        beforeEach('advance blocktime', async () => {
          // Wait til first epoch.
          await advanceTimeAndBlock(
            provider,
            startTime.sub(await latestBlocktime(provider)).toNumber()
          );
        });

        it('should not fund treasury if price > targetPrice and price < expansionLimitPrice with 0% bonds', async () => {
          const cashPrice = ETH.mul(103).div(100);
          await oracle.setPrice(cashPrice);
          expect((await bond.totalSupply()).eq(0))

          const oldCashSupply = await cash.totalSupply();
          const oldCashBalanceOfTreasury = await cash.balanceOf(treasury.address);

          // calculate with circulating supply without considering uniswap liq.
          const treasuryHoldings = BigNumber.from((await treasury.state()).accumulatedSeigniorage.toString());
          const cashSupply = (await cash.totalSupply()).sub(treasuryHoldings);

          const percentage = bigmin(
            cashPrice.sub(ETH).mul(100).div(ETH),
            BigNumber.from((await treasury.state()).maxSupplyIncreasePerEpoch.toString())
          );

          let seigniorageToMint = cashSupply
            .mul(percentage)
            .div(100);

          const seigniorage = await treasury.estimateSeignorageToMint(cashPrice); // all are same oracle.
          const finalSeigniorageToMint = bigmin(
            seigniorageToMint,
            await bond.totalSupply()
          );

          expect(seigniorage.eq(finalSeigniorageToMint))

          // TODO: check emit for all respective events.
          await expect(treasury.connect(ant).allocateSeigniorage())
            .to.not.emit(treasury, 'SeigniorageMinted')
            .to.not.emit(treasury, 'TreasuryFunded')
            .to.not.emit(treasury, 'PoolFunded');

          expect(finalSeigniorageToMint.eq(0))

          expect(await cash.totalSupply()).to.eq(oldCashSupply.add(ETH.mul(300)));
          expect(await cash.balanceOf(ant.address)).to.eq(ETH.mul(300)); // 200 ARTH bonus
          expect(await cash.balanceOf(treasury.address)).to.eq(oldCashBalanceOfTreasury);
        });
      });
    });
  });

  // describe('getPercentDeviationFromTarget', () => {
  //   it('returns 0 at 1$ price with a target of 1$', async () => {
  //     const price = utils.parseEther('1')
  //     console.log(simpleOracle.getPrice().toString());
  //     await expect(await treasuryLibrary.getPercentDeviationFromTarget(price, simpleOracle)).to.be.eq(0);
  //   });

  //   it('returns 10 at 1.1$ price with a target of 1$', async () => {
  //     const price = utils.parseEther('11').div(10)
  //     await expect(await treasuryLibrary.getPercentDeviationFromTarget(price, simpleOracle)).to.be.eq(10);
  //   });

  //   it('returns 20 at 1.2$ price with a target of 1$', async () => {
  //     const price = utils.parseEther('12').div(10)
  //     await expect(await treasuryLibrary.getPercentDeviationFromTarget(price, simpleOracle)).to.be.eq(20);
  //   });

  //   it('returns 100 at 0$ price with a target of 1$', async () => {
  //     await expect(await treasuryLibrary.getPercentDeviationFromTarget(0, simpleOracle)).to.be.eq(100);
  //   });

  //   it('returns 100 at 2$ price with a target of 1$', async () => {
  //     const price = utils.parseEther('2')
  //     await expect(await treasuryLibrary.getPercentDeviationFromTarget(price, simpleOracle)).to.be.eq(100);
  //   });

  //   it('returns 10 at 0.9$ price with a target of 1$', async () => {
  //     const price = utils.parseEther('9').div(10)
  //     await expect(await treasuryLibrary.getPercentDeviationFromTarget(price, simpleOracle)).to.be.eq(10);
  //   });

  //   it('returns 50 at 0.5$ price with a target of 1$', async () => {
  //     const price = utils.parseEther('5').div(10)
  //     await expect(await treasuryLibrary.getPercentDeviationFromTarget(price, simpleOracle)).to.be.eq(50);
  //   });

  //   it('returns 200 at 3$ price with a target of 1$', async () => {
  //     const price = utils.parseEther('30').div(10)
  //     await expect(await treasuryLibrary.getPercentDeviationFromTarget(price, simpleOracle)).to.be.eq(200);
  //   });

  //   it('returns 50 at 1$ price with a target of 2$', async () => {
  //     const price = utils.parseEther('1')
  //     await gmuOracle.setPrice(utils.parseEther('2'));
  //     await expect(await treasuryLibrary.getPercentDeviationFromTarget(price, simpleOracle)).to.be.eq(50);
  //   });

  //   it('returns 75 at 3.5$ price with a target of 2$', async () => {
  //     const price = utils.parseEther('35').div(10)
  //     await gmuOracle.setPrice(utils.parseEther('2'));
  //     await expect(await treasuryLibrary.getPercentDeviationFromTarget(price, simpleOracle)).to.be.eq(75);
  //   });
  // })

  describe('estimateSeignorageToMint', () => {
    it('at 1$ and 0 ARTHB we mint 0 ARTH', async () => {
      const price = utils.parseEther('10').div(10)
      await expect(await treasury.estimateSeignorageToMint(price)).to.be.eq(0);
    });

    it('at 0.99$ and 0 ARTHB we mint 0 ARTH', async () => {
      const price = utils.parseEther('99').div(100)
      await expect(await treasury.estimateSeignorageToMint(price)).to.be.eq(0);
    });

    it('at 1.01$ and 0 ARTHB we mint 0 ARTH', async () => {
      const price = utils.parseEther('101').div(100)
      await expect(await treasury.estimateSeignorageToMint(price)).to.be.eq(0);
    });

    it('at 1.01$ and 5% ARTHB we mint 1% more ARTH', async () => {
      const arthSupply = await cash.totalSupply()

      const price = utils.parseEther('101').div(100)
      await bond.mint(operator.address, arthSupply.mul(5).div(100));

      // await expect(await treasuryLibrary.getPercentDeviationFromTarget(price)).to.be.eq(1);
      await expect(await treasury.estimateSeignorageToMint(price)).to.be.eq(arthSupply.mul(1).div(100));
    });

    it('at 1.05$ and 5% ARTHB we mint 5% ARTH', async () => {
      const arthSupply = await cash.totalSupply()

      const price = utils.parseEther('105').div(100)
      await bond.mint(operator.address, arthSupply.mul(5).div(100));

      // await expect(await treasuryLibrary.getPercentDeviationFromTarget(price)).to.be.eq(5);
      await expect(await treasury.estimateSeignorageToMint(price)).to.be.eq(arthSupply.mul(5).div(100));
    });

    it('at 1.05$ and 10% ARTHB we mint 5% ARTH', async () => {
      const arthSupply = await cash.totalSupply()

      const price = utils.parseEther('105').div(100)
      await bond.mint(operator.address, arthSupply.mul(10).div(100));

      // await expect(await treasuryLibrary.getPercentDeviationFromTarget(price)).to.be.eq(5);
      await expect(await treasury.estimateSeignorageToMint(price)).to.be.eq(arthSupply.mul(5).div(100));
    });

    it('at 1.10$ and 10% ARTHB we mint 10% ARTH', async () => {
      const arthSupply = await cash.totalSupply()

      const price = utils.parseEther('110').div(100)
      await bond.mint(operator.address, arthSupply.mul(10).div(100));

      // await expect(await treasuryLibrary.getPercentDeviationFromTarget(price)).to.be.eq(10);
      await expect(await treasury.estimateSeignorageToMint(price)).to.be.eq(arthSupply.mul(10).div(100));
    });

    it('at 1.04$ and 3% ARTHB we mint 10% ARTH', async () => {
      const arthSupply = await cash.totalSupply()

      const price = utils.parseEther('104').div(100)
      await bond.mint(operator.address, arthSupply.mul(3).div(100));

      // await expect(await treasuryLibrary.getPercentDeviationFromTarget(price)).to.be.eq(4);
      await expect(await treasury.estimateSeignorageToMint(price)).to.be.eq(arthSupply.mul(3).div(100));
    });

    it('at 1.10$ and 0% ARTHB we mint 10% ARTH', async () => {
      const arthSupply = await cash.totalSupply()

      const price = utils.parseEther('110').div(100)

      // await expect(await treasuryLibrary.getPercentDeviationFromTarget(price)).to.be.eq(10);
      await expect(await treasury.estimateSeignorageToMint(price)).to.be.eq(arthSupply.mul(10).div(100));
    });

    it('at 1.50$ and 0% ARTHB we mint 10% ARTH', async () => {
      const arthSupply = await cash.totalSupply()

      const price = utils.parseEther('150').div(100)

      // await expect(await treasuryLibrary.getPercentDeviationFromTarget(price)).to.be.eq(50);
      await expect(await treasury.estimateSeignorageToMint(price)).to.be.eq(arthSupply.mul(10).div(100));
    });
  })

  describe('estimateBondsToIssue without uniswap liq', () => {
    beforeEach('disable uniswap liq into consideration', async () => {
      // Wait til first epoch.
      await treasury.connect(operator).setConsiderUniswapLiquidity(false);
    });

    it('at 1$ a we issue 0 ARTHB', async () => {
      const price = utils.parseEther('10').div(10)
      await expect(await treasury.estimateBondsToIssue(price)).to.be.eq(0);
    });

    it('at 0.99$ a we issue 0 ARTHB', async () => {
      const price = utils.parseEther('99').div(100)
      await expect(await treasury.estimateBondsToIssue(price)).to.be.eq(0);
    });

    it('at 1.99$ a we issue 0 ARTHB', async () => {
      const price = utils.parseEther('199').div(100)
      await expect(await treasury.estimateBondsToIssue(price)).to.be.eq(0);
    });

    it('at 0.96$ a we issue 0% ARTHB', async () => {
      const arthSupply = await cash.totalSupply()

      const price = utils.parseEther('96').div(100)
      await expect(await treasury.estimateBondsToIssue(price)).to.be.eq(0);
    });

    it('at 0.95$ a we issue 5% ARTHB', async () => {
      const arthSupply = await cash.totalSupply()

      const price = utils.parseEther('95').div(100)

      const bondsIssued = await treasury.estimateBondsToIssue(price);
      await expect(bondsIssued)
        .to
        .be
        .eq(arthSupply.mul(5).div(100));

      await expect(bondsIssued)
        .to
        .be
        .not.eq(0);
    });

    it('at 0.90$ a we issue 5% ARTHB', async () => {
      const arthSupply = await cash.totalSupply()

      const price = utils.parseEther('90').div(100)
      const bondsIssued = await treasury.estimateBondsToIssue(price);

      await expect(bondsIssued)
        .to
        .be
        .eq(arthSupply.mul(5).div(100));

      await expect(bondsIssued)
        .to
        .be
        .not.eq(0);
    });
  })

  describe('estimateBondsToIssue with uniswap liq.', () => {
    beforeEach('disable uniswap liq into consideration', async () => {
      // Wait til first epoch.
      await treasury.connect(operator).setConsiderUniswapLiquidity(true);
    });

    it('at 1$ a we issue 0 ARTHB', async () => {
      const price = utils.parseEther('10').div(10)
      await expect(await treasury.estimateBondsToIssue(price)).to.be.eq(0);
    });

    it('at 0.99$ a we issue 0 ARTHB', async () => {
      const price = utils.parseEther('99').div(100)
      await expect(await treasury.estimateBondsToIssue(price)).to.be.eq(0);
    });

    it('at 1.99$ a we issue 0 ARTHB', async () => {
      const price = utils.parseEther('199').div(100)
      await expect(await treasury.estimateBondsToIssue(price)).to.be.eq(0);
    });

    it('at 0.96$ a we issue 0% ARTHB', async () => {
      const arthSupply = await cash.totalSupply()

      const price = utils.parseEther('96').div(100)
      await expect(await treasury.estimateBondsToIssue(price)).to.be.eq(0);
    });

    it('at 0.95$ a we issue 5% ARTHB', async () => {
      const arthSupply = await cash.totalSupply()

      const uniswapLiquidityPair =
        await uniswap.getPair(cash.address, dai.address);
      const uniswapLiquidity = await cash.balanceOf(uniswapLiquidityPair);

      const percentUniswapLiq = uniswapLiquidity.mul(100).div(await cash.totalSupply())

      const price = utils.parseEther('95').div(100)

      const bondsIssued = await treasury.estimateBondsToIssue(price);
      await expect(bondsIssued)
        .to
        .be
        .eq(arthSupply.mul(5).div(100).mul(percentUniswapLiq).div(100));

      await expect(bondsIssued)
        .to
        .be
        .not.eq(0);
    });

    it('at 0.90$ a we issue 5% ARTHB', async () => {
      const arthSupply = await cash.totalSupply()

      const uniswapLiquidityPair =
        await uniswap.getPair(cash.address, dai.address);
      const uniswapLiquidity = await cash.balanceOf(uniswapLiquidityPair);

      const percentUniswapLiq = uniswapLiquidity.mul(100).div(await cash.totalSupply())

      const price = utils.parseEther('90').div(100)
      const bondsIssued = await treasury.estimateBondsToIssue(price);

      await expect(bondsIssued)
        .to
        .be
        .eq(arthSupply.mul(5).div(100).mul(percentUniswapLiq).div(100));

      await expect(bondsIssued)
        .to
        .be
        .not.eq(0);
    });
  })

  describe('bonds', async () => {
    beforeEach('transfer permissions', async () => {
      // await cash.mint(operator.address, INITIAL_BAC_AMOUNT.mul(2));
      await bond.mint(operator.address, INITIAL_BAB_AMOUNT);
      for await (const contract of [cash, bond, arthMahaswapLiquidityBoardroom, arthBoardroom, contractionBoardroom1, contractionBoardroom2, contractionBoardroom3, mahaLiquidityBoardroom]) {
        await contract.connect(operator).transferOperator(treasury.address);
      }
    });

    describe('after migration', () => {
      it('should fail if contract migrated', async () => {
        for await (const contract of [cash, bond]) {
          await contract
            .connect(operator)
            .transferOwnership(treasury.address);
        }

        await treasury.connect(operator).migrate(operator.address);

        const flags = await treasury.flags();
        const migrated = flags.migrated;

        expect(migrated).to.be.true;

        await expect(treasury.allocateSeigniorage()).to.revertedWith(
          'Treasury: migrated'
        );
      });
    });

    describe('before startTime', () => {
      it('should fail if not started yet', async () => {
        await expect(treasury.buyBonds(ETH, ETH)).to.revertedWith(
          'Epoch: not started yet'
        );
        await expect(treasury.redeemBonds(ETH)).to.revertedWith(
          'Epoch: not started yet'
        );
      });
    });

    describe('after startTime', () => {
      beforeEach('advance blocktime', async () => {
        // wait til first epoch
        await advanceTimeAndBlock(
          provider,
          startTime.sub(await latestBlocktime(provider)).toNumber()
        );
      });

      describe('#buyBonds without uniswap liq.', () => {
        beforeEach('advance blocktime', async () => {
          // wait til first epoch
          await treasury.connect(operator).setConsiderUniswapLiquidity(
            false
          );
        });

        it('should not work if cash price < targetPrice and price > bondPurchasePrice', async () => {
          const cashPrice = ETH.mul(99).div(100); // $0.99
          await oracle.setPrice(cashPrice);
          await oracle.setEpoch(1);

          // trigger updateConversionRate
          await treasury.allocateSeigniorage();

          await dai.connect(operator).transfer(ant.address, ETH);
          await dai.connect(ant).approve(treasury.address, ETH);
          await cash.connect(ant).approve(treasury.address, ETH);

          await expect(treasury.connect(ant).buyBonds(ETH, cashPrice)).to.revertedWith(
            'cash price not eligible'
          )

          expect(await dai.balanceOf(ant.address)).to.eq(ETH);
          expect(await bond.balanceOf(ant.address)).to.eq(ZERO);
        });

        it('should work if cash price < targetPrice and price < bondPurchasePrice', async () => {
          const cashPrice = ETH.mul(90).div(100); // $0.99
          await oracle.setPrice(cashPrice);
          await oracle.setEpoch(1);

          // trigger updateConversionRate
          await treasury.allocateSeigniorage();

          await oracle.setPrice(cashPrice);

          await dai.connect(operator).transfer(ant.address, ETH);
          await dai.connect(ant).approve(treasury.address, ETH);
          await cash.connect(ant).approve(treasury.address, ETH);

          expect(await treasury.connect(ant).buyBonds(ETH, cashPrice))

          expect(await dai.balanceOf(ant.address)).to.eq(ZERO);
          expect(await bond.balanceOf(ant.address)).to.gt(ZERO);
        });

        it('should fail if cash price > targetPrice and price < bondRedemtionPrice', async () => {
          const cashPrice = ETH.mul(101).div(100); // $1.01
          await oracle.setPrice(cashPrice);

          await dai.connect(operator).transfer(ant.address, ETH);
          await dai.connect(ant).approve(treasury.address, ETH);
          await cash.connect(ant).approve(treasury.address, ETH);

          await expect(
            treasury.connect(ant).buyBonds(ETH, cashPrice)
          ).to.revertedWith(
            'cash price not eligible'
          );
        });

        it('should fail if price changed', async () => {
          const cashPrice = ETH.mul(99).div(100); // $0.99
          await oracle.setPrice(cashPrice);

          await dai.connect(operator).transfer(ant.address, ETH);
          await dai.connect(ant).approve(treasury.address, ETH);
          await cash.connect(ant).approve(treasury.address, ETH);

          await expect(
            treasury.connect(ant).buyBonds(ETH, ETH.mul(98).div(100))
          ).to.revertedWith('cash price moved');
        });

        it('should fail if purchase bonds with zero amount', async () => {
          const cashPrice = ETH.mul(99).div(100); // $0.99
          await oracle.setPrice(cashPrice);

          await expect(
            treasury.connect(ant).buyBonds(ZERO, cashPrice)
          ).to.revertedWith('zero amount');
        });

        it('should not update conversion limit if price is < targetPrice and price > bondPurchasePrice', async () => {
          const cashPrice = ETH.mul(99).div(100);
          await oracle.setPrice(cashPrice);
          await oracle.setEpoch(1);

          await dai.connect(operator).transfer(ant.address, ETH);
          await dai.connect(ant).approve(treasury.address, ETH);
          await cash.connect(ant).approve(treasury.address, ETH);

          const getStatus = async () => ({
            lim: (await treasury.state()).cashToBondConversionLimit,
            acc: (await treasury.state()).accumulatedBonds,
          });

          const status = await getStatus();
          expect(status.lim).to.eq(0);
          expect(status.acc).to.eq(0);

          // trigger updateConversionRate
          await treasury.allocateSeigniorage();

          await expect(treasury.connect(ant).buyBonds(ETH, cashPrice)).to.revertedWith(
            'cash price not eligible'
          );
          const newStatus = await getStatus();

          expect(status.lim).to.eq(newStatus.lim);
          expect(status.acc).to.eq(newStatus.acc);
        });

        it('should not update conversion limit if price is > targetPrice', async () => {
          const cashPrice = ETH.mul(101).div(100);
          await oracle.setPrice(cashPrice);
          await oracle.setEpoch(1);

          await dai.connect(operator).transfer(ant.address, ETH);
          await dai.connect(ant).approve(treasury.address, ETH);
          await cash.connect(ant).approve(treasury.address, ETH);

          const getStatus = async () => ({
            lim: (await treasury.state()).cashToBondConversionLimit,
            acc: (await treasury.state()).accumulatedBonds,
          });

          const status = await getStatus();
          expect(status.lim).to.eq(0);
          expect(status.acc).to.eq(0);

          // trigger updateConversionRate
          await treasury.allocateSeigniorage();

          await expect(treasury.connect(ant).buyBonds(ETH, cashPrice)).to.revertedWith('cash price not eligible');
          const newStatus = await getStatus();

          expect(status.lim).to.eq(newStatus.lim);
          expect(status.acc).to.eq(newStatus.acc);
        });

        it('should not update conversion limit if price is > targetPrice and price > bondRedemtionPrice', async () => {
          const cashPrice = ETH.mul(110).div(100);
          await oracle.setPrice(cashPrice);
          await oracle.setEpoch(1);

          await dai.connect(operator).transfer(ant.address, ETH);
          await dai.connect(ant).approve(treasury.address, ETH);
          await cash.connect(ant).approve(treasury.address, ETH);

          const getStatus = async () => ({
            lim: (await treasury.state()).cashToBondConversionLimit,
            acc: (await treasury.state()).accumulatedBonds,
          });

          const status = await getStatus();
          expect(status.lim).to.eq(0);
          expect(status.acc).to.eq(0);

          // trigger updateConversionRate
          await treasury.allocateSeigniorage();

          await expect(treasury.connect(ant).buyBonds(ETH, cashPrice)).to.revertedWith('cash price not eligible');
          const newStatus = await getStatus();

          expect(newStatus.lim).to.eq(0);
          expect(status.acc).to.eq(newStatus.acc);
        });

        it('should update conversion limit if price < targetPrice and price < bondPurchasePrice', async () => {
          const cashPrice = ETH.mul(90).div(100);
          await oracle.setPrice(cashPrice);
          await oracle.setEpoch(1);

          await dai.connect(operator).transfer(ant.address, ETH);
          await dai.connect(ant).approve(treasury.address, ETH);
          await cash.connect(ant).approve(treasury.address, ETH);

          const getStatus = async () => ({
            lim: (await treasury.state()).cashToBondConversionLimit,
            acc: (await treasury.state()).accumulatedBonds,
          });

          const status = await getStatus();
          expect(status.lim).to.eq(0);
          expect(status.acc).to.eq(0);

          // trigger updateConversionRate
          await treasury.allocateSeigniorage();

          expect(await treasury.connect(ant).buyBonds(ETH, cashPrice))
          const newStatus = await getStatus();

          expect(status.lim).to.not.eq(newStatus.lim);
          expect(status.acc).to.not.eq(newStatus.acc);
        });

        it('should not purchase over conversion limit', async () => {
          const cashPrice = ETH.mul(90).div(100);
          await oracle.setPrice(cashPrice);
          await oracle.setEpoch(1);

          const circulatingSupply = await treasury.arthCirculatingSupply();
          const limit = circulatingSupply.mul(ETH.sub(cashPrice)).div(ETH);

          await dai.connect(operator).transfer(ant.address, limit.add(1));
          await dai.connect(ant).approve(treasury.address, limit.add(1));
          await cash.connect(ant).approve(treasury.address, limit.add(1));

          await expect(
            treasury.connect(ant).buyBonds(limit.add(1), cashPrice)
          ).to.revertedWith('no more bonds');
        });
      });

      describe('#buyBonds considering uniswpa liq.', () => {
        beforeEach('disable uniswap liq into consideration', async () => {
          // Wait til first epoch.
          await treasury.connect(operator).setConsiderUniswapLiquidity(true);
        });

        it('should not work if cash price < targetPrice and price > bondPurchasePrice', async () => {
          const cashPrice = ETH.mul(99).div(100); // $0.99
          await oracle.setPrice(cashPrice);
          await oracle.setEpoch(1);

          // trigger updateConversionRate
          await treasury.allocateSeigniorage();

          await dai.connect(operator).transfer(ant.address, ETH);
          await dai.connect(ant).approve(treasury.address, ETH);
          await cash.connect(ant).approve(treasury.address, ETH);

          await expect(treasury.connect(ant).buyBonds(ETH, cashPrice)).to.revertedWith(
            'cash price not eligible'
          )

          expect(await dai.balanceOf(ant.address)).to.eq(ETH);
          expect(await bond.balanceOf(ant.address)).to.eq(ZERO);
        });

        it('should work if cash price < targetPrice and price < bondPurchasePrice', async () => {
          const cashPrice = ETH.mul(90).div(100); // $0.99
          await oracle.setPrice(cashPrice);
          await oracle.setEpoch(1);

          // trigger updateConversionRate
          await treasury.allocateSeigniorage();

          await oracle.setPrice(cashPrice);

          await dai.connect(operator).transfer(ant.address, ETH);
          await dai.connect(ant).approve(treasury.address, ETH);
          await cash.connect(ant).approve(treasury.address, ETH);

          expect(await treasury.connect(ant).buyBonds(ETH, cashPrice))

          expect(await dai.balanceOf(ant.address)).to.eq(ZERO);
          expect(await bond.balanceOf(ant.address)).to.gt(ZERO);
        });

        it('should fail if cash price > targetPrice and price < bondRedemtionPrice', async () => {
          const cashPrice = ETH.mul(101).div(100); // $1.01
          await oracle.setPrice(cashPrice);

          await dai.connect(operator).transfer(ant.address, ETH);
          await dai.connect(ant).approve(treasury.address, ETH);
          await cash.connect(ant).approve(treasury.address, ETH);

          await expect(
            treasury.connect(ant).buyBonds(ETH, cashPrice)
          ).to.revertedWith(
            'cash price not eligible'
          );
        });

        it('should fail if price changed', async () => {
          const cashPrice = ETH.mul(99).div(100); // $0.99
          await oracle.setPrice(cashPrice);

          await dai.connect(operator).transfer(ant.address, ETH);
          await dai.connect(ant).approve(treasury.address, ETH);
          await cash.connect(ant).approve(treasury.address, ETH);

          await expect(
            treasury.connect(ant).buyBonds(ETH, ETH.mul(98).div(100))
          ).to.revertedWith('cash price moved');
        });

        it('should fail if purchase bonds with zero amount', async () => {
          const cashPrice = ETH.mul(99).div(100); // $0.99
          await oracle.setPrice(cashPrice);

          await expect(
            treasury.connect(ant).buyBonds(ZERO, cashPrice)
          ).to.revertedWith('zero amount');
        });

        it('should not update conversion limit if price is < targetPrice and price > bondPurchasePrice', async () => {
          const cashPrice = ETH.mul(99).div(100);
          await oracle.setPrice(cashPrice);
          await oracle.setEpoch(1);

          await dai.connect(operator).transfer(ant.address, ETH);
          await dai.connect(ant).approve(treasury.address, ETH);
          await cash.connect(ant).approve(treasury.address, ETH);

          const getStatus = async () => ({
            lim: (await treasury.state()).cashToBondConversionLimit,
            acc: (await treasury.state()).accumulatedBonds,
          });

          const status = await getStatus();
          expect(status.lim).to.eq(0);
          expect(status.acc).to.eq(0);

          // trigger updateConversionRate
          await treasury.allocateSeigniorage();

          await expect(treasury.connect(ant).buyBonds(ETH, cashPrice)).to.revertedWith(
            'cash price not eligible'
          );
          const newStatus = await getStatus();

          expect(status.lim).to.eq(newStatus.lim);
          expect(status.acc).to.eq(newStatus.acc);
        });

        it('should not update conversion limit if price is > targetPrice', async () => {
          const cashPrice = ETH.mul(101).div(100);
          await oracle.setPrice(cashPrice);
          await oracle.setEpoch(1);

          await dai.connect(operator).transfer(ant.address, ETH);
          await dai.connect(ant).approve(treasury.address, ETH);
          await cash.connect(ant).approve(treasury.address, ETH);

          const getStatus = async () => ({
            lim: (await treasury.state()).cashToBondConversionLimit,
            acc: (await treasury.state()).accumulatedBonds,
          });

          const status = await getStatus();
          expect(status.lim).to.eq(0);
          expect(status.acc).to.eq(0);

          // trigger updateConversionRate
          await treasury.allocateSeigniorage();

          await expect(treasury.connect(ant).buyBonds(ETH, cashPrice)).to.revertedWith('cash price not eligible');
          const newStatus = await getStatus();

          expect(status.lim).to.eq(newStatus.lim);
          expect(status.acc).to.eq(newStatus.acc);
        });

        it('should not update conversion limit if price is > targetPrice and price > bondRedemtionPrice', async () => {
          const cashPrice = ETH.mul(110).div(100);
          await oracle.setPrice(cashPrice);
          await oracle.setEpoch(1);

          await dai.connect(operator).transfer(ant.address, ETH);
          await dai.connect(ant).approve(treasury.address, ETH);
          await cash.connect(ant).approve(treasury.address, ETH);

          const getStatus = async () => ({
            lim: (await treasury.state()).cashToBondConversionLimit,
            acc: (await treasury.state()).accumulatedBonds,
          });

          const status = await getStatus();
          expect(status.lim).to.eq(0);
          expect(status.acc).to.eq(0);

          // trigger updateConversionRate
          await treasury.allocateSeigniorage();

          await expect(treasury.connect(ant).buyBonds(ETH, cashPrice)).to.revertedWith('cash price not eligible');
          const newStatus = await getStatus();

          expect(newStatus.lim).to.eq(0);
          expect(status.acc).to.eq(newStatus.acc);
        });

        it('should update conversion limit if price < targetPrice and price < bondPurchasePrice', async () => {
          const cashPrice = ETH.mul(90).div(100);
          await oracle.setPrice(cashPrice);
          await oracle.setEpoch(1);

          await dai.connect(operator).transfer(ant.address, ETH);
          await dai.connect(ant).approve(treasury.address, ETH);
          await cash.connect(ant).approve(treasury.address, ETH);

          const getStatus = async () => ({
            lim: (await treasury.state()).cashToBondConversionLimit,
            acc: (await treasury.state()).accumulatedBonds,
          });

          const status = await getStatus();
          expect(status.lim).to.eq(0);
          expect(status.acc).to.eq(0);

          // trigger updateConversionRate
          await treasury.allocateSeigniorage();

          expect(await treasury.connect(ant).buyBonds(ETH, cashPrice))
          const newStatus = await getStatus();

          expect(status.lim).to.not.eq(newStatus.lim);
          expect(status.acc).to.not.eq(newStatus.acc);
        });

        it('should not purchase over conversion limit', async () => {
          const cashPrice = ETH.mul(90).div(100);
          await oracle.setPrice(cashPrice);
          await oracle.setEpoch(1);

          const circulatingSupply = await treasury.arthCirculatingSupply();
          const limit = circulatingSupply.mul(ETH.sub(cashPrice)).div(ETH);

          await dai.connect(operator).transfer(ant.address, limit.add(1));
          await dai.connect(ant).approve(treasury.address, limit.add(1));
          await cash.connect(ant).approve(treasury.address, limit.add(1));

          await expect(
            treasury.connect(ant).buyBonds(limit.add(1), cashPrice)
          ).to.revertedWith('no more bonds');
        });
      });

      describe('#redeemBonds', () => {
        beforeEach('allocate seigniorage to treasury', async () => {
          const cashPrice = ETH.mul(106).div(100);
          await oracle.setPrice(cashPrice);

          await treasury.allocateSeigniorage();

          await advanceTimeAndBlock(
            provider,
            Number(await treasury.nextEpochPoint()) -
            (await latestBlocktime(provider))
          );
        });

        it('should work if cash price exceeds bondRedemtionPrice', async () => {
          const cashPrice = ETH.mul(106).div(100);
          await oracle.setPrice(cashPrice);

          await bond.connect(operator).transfer(ant.address, ETH);
          await bond.connect(ant).approve(treasury.address, ETH);
          await share.connect(operator).mint(ant.address, ETH);
          await share.connect(ant).approve(treasury.address, ETH);

          await expect(treasury.connect(ant).redeemBonds(ETH))
            .to.emit(treasury, 'RedeemedBonds')
            .withArgs(ant.address, ETH);

          expect(await bond.balanceOf(ant.address)).to.eq(ZERO); // 1:1
          expect(await cash.balanceOf(ant.address)).to.eq(ETH);
        });

        it("should drain over seigniorage and even contract's budget", async () => {
          const cashPrice = ETH.mul(106).div(100);
          await oracle.setPrice(cashPrice);

          await cash.connect(operator).transfer(treasury.address, ETH); // $1002

          const treasuryBalance = await cash.balanceOf(treasury.address);
          await bond.connect(operator).transfer(ant.address, treasuryBalance);
          await bond.connect(ant).approve(treasury.address, treasuryBalance);

          const oldSeigniorage = (await treasury.state()).accumulatedSeigniorage;
          const amount = bigmin(
            oldSeigniorage,
            treasuryBalance
          )

          await treasury.connect(ant).redeemBonds(amount);

          expect(await bond.balanceOf(ant.address)).to.eq(treasuryBalance.sub(amount));
          expect(await cash.balanceOf(ant.address)).to.eq(amount); // 1:1
          expect((await treasury.state()).accumulatedSeigniorage).to.eq(oldSeigniorage.sub(amount));
        });

        it('should fail if redeem bonds with zero amount', async () => {
          const cashPrice = ETH.mul(106).div(100);
          await oracle.setPrice(cashPrice);

          await expect(treasury.connect(ant).redeemBonds(ZERO)).to.revertedWith(
            'zero amount'
          );
        });

        it('should fail if cash price is below bondRedemtionPrice', async () => {
          const cashPrice = ETH.mul(99).div(100);
          await oracle.setPrice(cashPrice);

          await bond.connect(operator).transfer(ant.address, ETH);
          await bond.connect(ant).approve(treasury.address, ETH);
          await expect(treasury.connect(ant).redeemBonds(ETH)).to.revertedWith(
            'cashPrice less than ceiling'
          );
        });

        it("should fail if redeem bonds over contract's budget", async () => {
          const cashPrice = ETH.mul(106).div(100);
          await oracle.setPrice(cashPrice);

          const treasuryBalance = await cash.balanceOf(treasury.address);
          const redeemAmount = treasuryBalance.add(ETH);
          await bond.connect(operator).transfer(ant.address, redeemAmount);
          await bond.connect(ant).approve(treasury.address, redeemAmount);

          await expect(
            treasury.connect(ant).redeemBonds(redeemAmount)
          ).to.revertedWith('treasury has not enough budget');
        });
      });
    });
  });
});

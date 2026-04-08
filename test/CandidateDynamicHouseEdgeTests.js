const truffleAssert = require("truffle-assertions");
const BN = require("bn.js");
const mineHelper = require("../helpers/MineHelper.js");

const EthexLoto = artifacts.require("../contracts/EthexLoto.sol");
const EthexJackpot = artifacts.require("../contracts/EthexJackpot.sol");
const EthexHouse = artifacts.require("../contracts/EthexHouse.sol");
const EthexSuperprize = artifacts.require("../contracts/EthexSuperprize.sol");

contract("Candidate Task - Dynamic House Edge", async (accounts) => {
    let gasPrice;
    const minBetAmount = new BN("10000000000000000"); // 0.01 ETH
    const JACKPOT_PERCENT = 10;

    const player = accounts[0];
    const hoster = accounts[1];

    let lotoContract;
    let houseContract;

    const deploy = async function () {
        const latestBlock = await web3.eth.getBlock("latest");
        const networkGasPrice = new BN(await web3.eth.getGasPrice());
        const baseFee = latestBlock.baseFeePerGas ? new BN(latestBlock.baseFeePerGas.toString()) : new BN("0");
        gasPrice = networkGasPrice.gt(baseFee) ? networkGasPrice : baseFee.add(new BN("1"));

        const jackpot = await EthexJackpot.new();
        const house = await EthexHouse.new();
        const superprize = await EthexSuperprize.new();
        const loto = await EthexLoto.new(jackpot.address, house.address, superprize.address);

        await jackpot.setLoto(loto.address);
        await superprize.setLoto(loto.address);

        // Refill loto balance so max payout checks pass during tests.
        await loto.payIn.sendTransaction({
            from: hoster,
            value: minBetAmount.mul(new BN("1000")),
            gas: 300000,
            gasPrice: gasPrice
        });

        lotoContract = loto;
        houseContract = house;

        // Keep compatibility with existing tests and blockhash rules.
        const lastBlock = await web3.eth.getBlock("latest");
        for (let i = lastBlock.number; i < 256; i++)
            await mineHelper.advanceBlock();
    };

    beforeEach(deploy);

    it("routes house fee for every marked cell count from 1 to 6", async () => {
        const combinations = {
            1: [1, 255, 255, 255, 255, 255],
            2: [1, 2, 255, 255, 255, 255],
            3: [1, 2, 3, 255, 255, 255],
            4: [1, 2, 3, 4, 255, 255],
            5: [1, 2, 3, 4, 5, 255],
            6: [1, 2, 3, 4, 5, 6]
        };

        let before = new BN(await web3.eth.getBalance(houseContract.address));
        for (let markedCount = 1; markedCount <= 6; markedCount++) {
            await lotoContract.placeBet.sendTransaction(`${createBetId()}${encodeCombination(combinations[markedCount])}`, {
                from: player,
                value: minBetAmount,
                gas: 3000000,
                gasPrice: gasPrice
            });

            const after = new BN(await web3.eth.getBalance(houseContract.address));
            assert.equal(
                after.sub(before).toString(),
                expectedHouseFee(minBetAmount, markedCount).toString(),
                `${markedCount}-cell house fee mismatch`
            );
            before = after;
        }
    });

    it("reverts when bet has zero marked cells", async () => {
        const zeroMarked = [255, 255, 255, 255, 255, 255];
        await truffleAssert.fails(
            lotoContract.placeBet.sendTransaction(`${createBetId()}${encodeCombination(zeroMarked)}`, {
                from: player,
                value: minBetAmount,
                gas: 3000000,
                gasPrice: gasPrice
            })
        );
    });

    it("uses dynamic house edge in expired bet refund", async () => {
        const oneMarked = [1, 255, 255, 255, 255, 255]; // 12%
        const param = `${createBetId()}${encodeCombination(oneMarked)}`;

        await lotoContract.placeBet.sendTransaction(param, {
            from: player,
            value: minBetAmount,
            gas: 3000000,
            gasPrice: gasPrice
        });

        for (let i = 0; i < 256; i++)
            await mineHelper.advanceBlock();

        const drawTx = await lotoContract.settleBets.sendTransaction({
            from: player,
            value: 0,
            gas: 3000000,
            gasPrice: gasPrice
        });

        const expectedRefund = expectedNetBet(minBetAmount, 1);
        truffleAssert.eventEmitted(drawTx, "RefundBet", (ev) => {
            assert.equal(ev.amount.toString(), expectedRefund.toString(), "refund should use dynamic house edge");
            return true;
        });
    });

    function expectedHouseFee(amount, markedCount) {
        return amount.mul(new BN(getHousePercent(markedCount))).div(new BN("100"));
    }

    function expectedNetBet(amount, markedCount) {
        const housePercent = getHousePercent(markedCount);
        return amount.mul(new BN((100 - JACKPOT_PERCENT - housePercent).toString())).div(new BN("100"));
    }

    function getHousePercent(markedCount) {
        if (markedCount === 1)
            return 12;
        if (markedCount <= 3)
            return 10;
        return 8;
    }
});

function encodeCombination(combination) {
    return combination.map((value) => value.toString(16).padStart(2, "0")).join("");
}

function createBetId() {
    return "0x" + "xxxxxxxxxxyxxxxxxxxxxxxyxxxxxxxx".replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0;
        const v = c === "x" ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

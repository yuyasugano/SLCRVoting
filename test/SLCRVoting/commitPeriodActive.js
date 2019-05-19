/* eslint-env mocha */
/* global contract assert artifacts */

const SLCRFactory = artifacts.require('./SLCRFactory.sol');
const SLCRVoting = artifacts.require('./SLCRVoting.sol');
const Token = artifacts.require('./Token.sol');

const utils = require('./utils.js');

contract('SLCRVoting', (accounts) => {
  describe('Function: commitPeriodActive', () => {
    const alice = accounts[0];
    let slcr;

    before(async () => {
      const token = await Token.deployed();
      const slcrFactory = await SLCRFactory.deployed();
      await slcrFactory.initToken(token.address);
      const receipt = await slcrFactory.newSLCR();
      slcr = SLCRVoting.at(receipt.logs[0].args.slcr);
    });

    it('should return true if the commit period is active', async () => {
      const defaultOptions = utils.defaultOptions();

      const pollID = utils.getPollIDFromReceipt(
        await utils.as(alice, slcr.startPoll, defaultOptions.quorum,
          defaultOptions.commitPeriod, defaultOptions.revealPeriod),
      );

      const commitPeriodActive = await slcr.commitPeriodActive.call(pollID);

      assert.strictEqual(commitPeriodActive, true, 'The commit period did not begin on poll instantiation');
    });

    it('should return false if the commit period is not active', async () => {
      const defaultOptions = utils.defaultOptions();

      const pollID = utils.getPollIDFromReceipt(
        await utils.as(alice, slcr.startPoll, defaultOptions.quorum,
          defaultOptions.commitPeriod, defaultOptions.revealPeriod),
      );

      try {
        await slcr.commitPeriodActive.call('420');
      } catch (err) {
        assert(utils.isEVMException(err), err.toString());
      }

      await utils.increaseTime(parseInt(defaultOptions.commitPeriod, 10) + 1);
      const commitPeriodActive = await slcr.commitPeriodActive.call(pollID);

      assert.strictEqual(commitPeriodActive, false, 'The commit period was active for a poll where it should have ended');
    });
  });
});


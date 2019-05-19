/* eslint-env mocha */
/* global contract assert artifacts */

const SLCRFactory = artifacts.require('./SLCRFactory.sol');
const SLCRVoting = artifacts.require('./SLCRVoting.sol');
const Token = artifacts.require('./Token.sol');

const utils = require('./utils.js');

contract('SLCRVoting', (accounts) => {
  describe('Function: getInsertPointForNumTokens', () => {
    const [alice, bob] = accounts;
    let token;
    let slcr;

    before(async () => {
      token = await Token.deployed();
      const slcrFactory = await SLCRFactory.deployed();
      await slcrFactory.initToken(token.address);
      const receipt = await slcrFactory.newSLCR();

      slcr = SLCRVoting.at(receipt.logs[0].args.slcr);

      await Promise.all(
        accounts.map(async (user) => {
          await token.transfer(user, 1000);
          await token.approve(slcr.address, 1000, { from: user });
        }),
      );
    });

    it('should return true if the poll has ended', async () => {
      const options = utils.defaultOptions();
      options.actor = alice;

      const pollID = await utils.startPollAndCommitVote(options, slcr);

      // End the poll
      await utils.increaseTime(parseInt(defaultOptions.commitPeriod, 10) + parseInt(defaultOptions.revealPeriod, 10) + 1);

      // Poll has already ended
      const pollEnded = await slcr.pollEnded.call(pollID);
      assert.strictEqual(pollEnded, true, 'poll should have ended.');
    });

    it('should return false if the poll has not ended', async () => {
      const options = utils.defaultOptions();
      options.actor = alice;
      options.votingRights = '20';
      options.prevPollID = '1';

      const pollID = await utils.startPollAndCommitVote(options, slcr);
      await utils.increaseTime(parseInt(defaultOptions.commitPeriod, 10) + 1);

      const pollEnded = await slcr.pollEnded.call(pollID);
      assert.strictEqual(pollEnded, false, 'poll should still be active');
    });

    it('should throw an error if the poll does not exist', async () => {
      const options = utils.defaultOptions();
      options.actor = bob;

      try {
        await slcr.pollEnded.call('9001');
        assert(false, 'should have thrown error for non-existant poll #9001');
      } catch (err) {
        assert(utils.isEVMException(err), err.toString());
      }
    });
  });
});


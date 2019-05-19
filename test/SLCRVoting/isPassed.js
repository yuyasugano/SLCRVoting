/* eslint-env mocha */
/* global contract assert artifacts */

const SLCRFactory = artifacts.require('./SLCRFactory.sol');
const SLCRVoting = artifacts.require('./SLCRVoting.sol');
const Token = artifacts.require('./Token.sol');

const utils = require('./utils.js');
const BN = require('bignumber.js');

contract('SLCRVoting', (accounts) => {
  describe('Function: isPassed', () => {
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

    it('should return true if the poll passed', async () => {
      const options = utils.defaultOptions();
      options.actor = alice;
      options.vote = '1';

      // make a poll and commit a vote for
      const pollID = await utils.startPollAndCommitVote(options, slcr);
      await utils.increaseTime(new BN(options.commitPeriod, 10).add(new BN('1', 10)).toNumber(10));

      await utils.as(options.actor, slcr.revealVote, pollID, options.vote, options.salt);
      await utils.increaseTime(new BN(options.revealPeriod, 10).add(new BN('1', 10)).toNumber(10));

      const isPassed = await slcr.isPassed.call(pollID);
      assert.strictEqual(isPassed, true, 'isPassed should have returned true for a passing poll');
    });

    it('should return false if the poll ended in a tie', async () => {
      const aliceOptions = utils.defaultOptions();
      aliceOptions.actor = alice;
      aliceOptions.vote = '0';

      const bobOptions = utils.defaultOptions();
      bobOptions.actor = bob;
      bobOptions.vote = '1';

      const options = utils.defaultOptions();

      // start the poll as alice
      const receipt = await utils.as(alice, slcr.startPoll, options.quorum,
        options.commitPeriod, options.revealPeriod);
      const pollID = utils.getPollIDFromReceipt(receipt);

      // commit for each voter
      await utils.commitAs(pollID, aliceOptions, slcr);
      await utils.commitAs(pollID, bobOptions, slcr);
      await utils.increaseTime(new BN(options.commitPeriod, 10).add(new BN('1', 10)).toNumber(10));

      // reveal for each voter
      await utils.as(aliceOptions.actor, slcr.revealVote, pollID, aliceOptions.vote,
        aliceOptions.salt);
      await utils.as(bobOptions.actor, slcr.revealVote, pollID, bobOptions.vote, bobOptions.salt);
      await utils.increaseTime(new BN(options.revealPeriod, 10).add(new BN('1', 10)).toNumber(10));

      // should be 1-1 tie
      const isPassed = await slcr.isPassed.call(pollID);
      assert.strictEqual(isPassed, false, 'isPassed should have returned false for a tie');
    });

    it('should return false if the nobody votes', async () => {
      const options = utils.defaultOptions();
      options.actor = alice;

      // start the poll
      const receipt = await utils.as(options.actor, slcr.startPoll, options.quorum,
        options.commitPeriod, options.revealPeriod);
      const pollID = utils.getPollIDFromReceipt(receipt);

      // go to the end of the time period
      const increase = new BN(options.commitPeriod, 10)
        .add(new BN(options.revealPeriod, 10))
        .add('1');
      await utils.increaseTime(increase.toNumber(10));

      const isPassed = await slcr.isPassed.call(pollID);
      assert.strictEqual(isPassed, false, 'isPassed should have returned false for a tie');
    });

    it('should revert if the poll has not ended', async () => {
      // create a poll
      const options = utils.defaultOptions();
      options.actor = alice;
      options.vote = '0';

      // make a poll and commit
      const pollID = await utils.startPollAndCommitVote(options, slcr);

      // call before reveal end date
      try {
        await slcr.isPassed.call(pollID);
      } catch (err) {
        assert(utils.isEVMException(err), err.toString());
        return;
      }
      assert(false, 'was able to call isPassed on a poll that was not finished');
    });
  });
});


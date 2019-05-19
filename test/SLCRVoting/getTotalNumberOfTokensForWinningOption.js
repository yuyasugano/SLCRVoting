/* eslint-env mocha */
/* global contract assert artifacts */

const SLCRFactory = artifacts.require('./SLCRFactory.sol');
const SLCRVoting = artifacts.require('./SLCRVoting.sol');
const Token = artifacts.require('./Token.sol');

const utils = require('./utils.js');
const BN = require('bignumber.js');

contract('SLCRVoting', (accounts) => {
  describe('Function: getTotalNumberOfTokensForWinningOption', () => {
    const [alice] = accounts;
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

    it('should return the total number of votes for if the poll passed', async () => {
      const options = utils.defaultOptions();
      options.actor = alice;
      options.vote = '1';

      // make a poll and commit and reveal a "for" vote
      const pollID = await utils.startPollAndCommitVote(options, slcr);
      await utils.increaseTime(new BN(options.commitPeriod, 10).add(new BN('1', 10)).toNumber(10));

      await utils.as(options.actor, slcr.revealVote, pollID, options.vote, options.salt);
      await utils.increaseTime(new BN(options.revealPeriod, 10).add(new BN('1', 10)).toNumber(10));

      // make sure poll passed
      const isPassed = await slcr.isPassed.call(pollID);
      assert.strictEqual(isPassed, true, 'poll has not passed!');

      // check the number of tokens
      // votesFor === tokens === options.numTokens
      const tokens = await slcr.getTotalNumberOfTokensForWinningOption.call(pollID);
      const votesFor = await utils.getVotesFor(pollID, slcr);

      assert.strictEqual(tokens.toString(), options.numTokens,
        'number of winning tokens were not equal to commited tokens');

      assert.strictEqual(tokens.toString(), votesFor.toString(),
        'number of winning tokens were not equal to tokens revealed for');
    });

    it('should return the total number of votes against if the poll did not pass', async () => {
      const options = utils.defaultOptions();
      options.actor = alice;
      options.vote = '0';

      // make a poll and commit and reveal an "against" vote
      const pollID = await utils.startPollAndCommitVote(options, slcr);
      await utils.increaseTime(new BN(options.commitPeriod, 10).add(new BN('1', 10)).toNumber(10));

      await utils.as(options.actor, slcr.revealVote, pollID, options.vote, options.salt);
      await utils.increaseTime(new BN(options.revealPeriod, 10).add(new BN('1', 10)).toNumber(10));

      // make sure poll did not pass
      const isPassed = await slcr.isPassed.call(pollID);
      assert.strictEqual(isPassed, false, 'poll has passed');

      // check the number of tokens
      // votesAgainst === tokens === options.numTokens
      const tokens = await slcr.getTotalNumberOfTokensForWinningOption.call(pollID);
      const votesAgainst = await utils.getVotesAgainst(pollID, slcr);

      assert.strictEqual(tokens.toString(), options.numTokens,
        'number of winning tokens were not equal to commited tokens');

      assert.strictEqual(tokens.toString(), votesAgainst.toString(),
        'number of winning tokens were not equal to tokens revealed against');
    });

    it('should fail if the poll has not yet ended', async () => {
      const options = utils.defaultOptions();
      options.actor = alice;
      options.vote = '1';

      // make a poll and commit a vote
      const pollID = await utils.startPollAndCommitVote(options, slcr);

      try {
        await slcr.getTotalNumberOfTokensForWinningOption.call(pollID);
      } catch (err) {
        assert(utils.isEVMException(err), err.toString());
        return;
      }
      assert(false,
        'was able to call getTotalNumberOfTokensForWinningOption when poll has not ended');
    });
  });
});


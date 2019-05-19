/* eslint-env mocha */
/* global contract assert artifacts */

const SLCRFactory = artifacts.require('./SLCRFactory.sol');
const SLCRVoting = artifacts.require('./SLCRVoting.sol');
const utils = require('./utils.js');
const BN = require('bignumber.js');

contract('SLCRVoting', (accounts) => {
  describe('Function: revealVotes', () => {
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

    it('should reveal an array of 1 vote', async () => {
      const options = utils.defaultOptions();
      options.actor = alice;

      const pollID = await utils.startPollAndCommitVote(options, slcr);

      const pollIDs = [pollID];
      const votes = [options.vote];
      const salts = [options.salt];

      await utils.increaseTime(new BN(options.commitPeriod, 10).add(new BN('1', 10)).toNumber(10));
      await utils.as(options.actor, slcr.revealVotes, pollIDs, votes, salts);

      const votesFor = await utils.getVotesFor(pollID, slcr);
      const errMsg = 'votesFor should be equal to numTokens';
      assert.strictEqual(options.numTokens, votesFor.toString(10), errMsg);
    });

    it('should reveal an array of 2 votes in 2 polls', async () => {
      const options1 = utils.defaultOptions();
      options1.actor = alice;
      options1.vote = '1';
      options1.salt = '420';
      const pollID1 = await utils.startPollAndCommitVote(options1, slcr);

      const options2 = utils.defaultOptions();
      options2.actor = alice;
      options2.vote = '1';
      options2.salt = '9001';
      const pollID2 = await utils.startPollAndCommitVote(options2, slcr);

      const pollIDs = [pollID1, pollID2];
      const votes = [options1.vote, options2.vote];
      const salts = [options1.salt, options2.salt];

      await utils.increaseTime(new BN(options1.commitPeriod, 10).add(new BN('1', 10)).toNumber(10));
      await utils.as(options1.actor, slcr.revealVotes, pollIDs, votes, salts);
      const errMsg = 'votesFor should be equal to numTokens';

      const votesFor1 = await utils.getVotesFor(pollID1, slcr);
      assert.strictEqual(options1.numTokens, votesFor1.toString(10), errMsg);

      const votesFor2 = await utils.getVotesFor(pollID2, slcr);
      assert.strictEqual(options2.numTokens, votesFor2.toString(10), errMsg);
    });
  });
});


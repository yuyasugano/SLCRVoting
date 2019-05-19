/* eslint-env mocha */
/* global contract assert artifacts */

const SLCRFactory = artifacts.require('./SLCRFactory.sol');
const SLCRVoting = artifacts.require('./SLCRVoting.sol');
const Token = artifacts.require('./Token.sol');

const utils = require('./utils.js');

contract('SLCRVoting', (accounts) => {
  describe('Function: commitVotes', () => {
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

    it('should commit an array of 1 vote for 1 poll', async () => {
      const options = utils.defaultOptions();
      options.actor = alice;

      // start a poll
      const receipt = await utils.as(options.actor, slcr.startPoll, options.quorum,
        options.commitPeriod, options.revealPeriod);
      const pollID = utils.getPollIDFromReceipt(receipt);

      // verify that the commit period is active
      const isActive = await slcr.commitPeriodActive(pollID);
      assert(isActive, 'poll\'s commit period is not active');

      // commit an array of 1 vote
      const secretHash = utils.createVoteHash(options.vote, options.salt);
      const prevPollID =
        await slcr.getInsertPointForNumTokens.call(options.actor, options.numTokens, pollID);

      const pollIDs = [pollID];
      const secretHashes = [secretHash];
      const numsTokens = [options.numTokens];
      const prevPollIDs = [prevPollID];
      utils.as(alice, slcr.commitVotes, pollIDs, secretHashes, numsTokens, prevPollIDs);
    });

    it('should commit an array of 2 votes for 2 polls', async () => {
      const options1 = utils.defaultOptions();
      options1.actor = alice;
      const options2 = utils.defaultOptions();
      options2.actor = bob;

      // start polls
      const receipt1 = await utils.as(options1.actor, slcr.startPoll, options1.quorum,
        options1.commitPeriod, options1.revealPeriod);
      const receipt2 = await utils.as(options2.actor, slcr.startPoll, options2.quorum,
        options2.commitPeriod, options2.revealPeriod);

      const pollID1 = utils.getPollIDFromReceipt(receipt1);
      const pollID2 = utils.getPollIDFromReceipt(receipt2);

      // verify that the commit period is active
      const isActive1 = await slcr.commitPeriodActive(pollID1);
      const isActive2 = await slcr.commitPeriodActive(pollID2);
      assert(isActive1, 'poll1\'s commit period is not active');
      assert(isActive2, 'poll2\'s commit period is not active');

      // Alice's secretHashes & prevPollIDs
      const secretHash1a = utils.createVoteHash(options1.vote, options1.numTokens);
      const secretHash1b = utils.createVoteHash(options1.vote, options1.numTokens);
      const prevPollID1a =
        await slcr.getInsertPointForNumTokens.call(options1.actor, options1.numTokens, pollID1);
      const prevPollID1b =
        await slcr.getInsertPointForNumTokens.call(options1.actor, options1.numTokens, pollID2);

      // Bob's secretHashes & prevPollIDs
      const secretHash2a = utils.createVoteHash(options2.actor, options2.numTokens);
      const secretHash2b = utils.createVoteHash(options2.actor, options2.numTokens);
      const prevPollID2a =
        await slcr.getInsertPointForNumTokens.call(options2.actor, options2.numTokens, pollID1);
      const prevPollID2b =
        await slcr.getInsertPointForNumTokens.call(options2.actor, options2.numTokens, pollID2);

      // Array of poll IDs
      const pollIDs = [pollID1, pollID2];

      // Alice's array of: secretHashes, numsTokens, prevPollIDs
      const secretHashes1 = [secretHash1a, secretHash1b];
      const numsTokens1 = [options1.numTokens, options1.numTokens];
      const prevPollIDs1 = [prevPollID1a, prevPollID1b];

      // Bob's array of: secretHashes, numsTokens, prevPollIDs
      const secretHashes2 = [secretHash2a, secretHash2b];
      const numsTokens2 = [options2.numTokens, options2.numTokens];
      const prevPollIDs2 = [prevPollID2a, prevPollID2b];

      // commit an array of 2 votes as Alice and 2 as Bob
      try {
        await utils.as(alice, slcr.commitVotes, pollIDs, secretHashes1, numsTokens1, prevPollIDs1);
        await utils.as(bob, slcr.commitVotes, pollIDs, secretHashes2, numsTokens2, prevPollIDs2);
      } catch(err) {
        assert(false, 'voter should have been able to commit an array of 2 votes');
      }
    });
  });
});


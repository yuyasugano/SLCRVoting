/* eslint-env mocha */
/* global contract assert artifacts */

const SLCRFactory = artifacts.require('./SLCRFactory.sol');
const SLCRVoting = artifacts.require('./SLCRVoting.sol');
const Token = artifacts.require('./Token.sol');

const utils = require('./utils.js');

contract('SLCRVoting', (accounts) => {
  describe('Function: commitVote', () => {
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

    it('should commit a vote for a poll', async () => {
      const options = utils.defaultOptions();
      options.actor = alice;

      const pollID = await utils.startPollAndCommitVote(options, slcr);
      const secretHash = utils.createVoteHash(options.vote, options.salt);
      const storedHash = await slcr.getCommitHash.call(options.actor, pollID.toString(10));

      assert.strictEqual(storedHash, secretHash, 'The secretHash was not stored properly');
    });

    it('should update a commit for a poll by changing the secretHash', async () => {
      const options = utils.defaultOptions();
      options.actor = alice;
      options.vote = '0';

      const errMsg = 'Alice was not able to update her commit';
      const pollID = '1';

      const originalHash = await slcr.getCommitHash.call(alice, pollID);
      const secretHash = utils.createVoteHash(options.vote, options.salt);
      const prevPollID =
        await slcr.getInsertPointForNumTokens.call(options.actor, options.numTokens, pollID);

      await utils.as(alice, slcr.commitVote, pollID, secretHash, options.numTokens, prevPollID);

      const storedHash = await slcr.getCommitHash.call(alice, pollID);

      assert.notEqual(originalHash, storedHash, errMsg);
      assert.strictEqual(storedHash, secretHash, errMsg);
    });

    it('should not allow a user to commit in a poll for which the commit period has ended', async () => {
      const pollID = 1;
      const errMsg = 'Alice was able to commit to a poll after its commit period ended';
      const options = utils.defaultOptions();
      options.vote = '0';

      await utils.increaseTime(parseInt(defaultOptions.commitPeriod, 10) + 1);

      const originalHash = await slcr.getCommitHash.call(alice, pollID);
      const secretHash = utils.createVoteHash(options.vote, options.salt);
      try {
        await utils.as(alice, slcr.commitVote, pollID, secretHash, options.numTokens, 0);
        assert(false, errMsg);
      } catch (err) {
        assert(utils.isEVMException(err), err.toString());
      }
      const storedHash = await slcr.getCommitHash.call(alice, pollID);

      assert.strictEqual(storedHash, originalHash, errMsg);
    });

    it('should not allow a user to commit for a poll which does not exist', async() => {
      const errMsg = 'Alice was able to commit to a poll which does not exist';
      const options = utils.defaultOptions();

      const secretHash = utils.createVoteHash(options.vote, options.salt);

      // The zero poll does not exist
      try {
        await utils.as(alice, slcr.commitVote, 0, secretHash, options.numTokens, 1);
        assert(false, errMsg);
      } catch (err) {
        assert(utils.isEVMException(err), err.toString());
      }

      const tokensCommitted = await slcr.getLockedTokens.call(alice);
      assert.strictEqual(tokensCommitted.toString(10), options.numTokens, errMsg);
    });

    it('should update a commit for a poll by changing the numTokens, and allow the user to withdraw all their tokens when the poll ends', async () => {
      const options = utils.defaultOptions();
      options.actor = bob;
      options.numTokens = '10';

      const startingBalance = await token.balanceOf.call(bob);

      const pollID = await utils.startPollAndCommitVote(options, slcr);
      const secretHash = utils.createVoteHash(options.vote, options.salt);
      await utils.as(bob, slcr.commitVote, pollID, secretHash, '20', 0);

      await utils.increaseTime(parseInt(defaultOptions.commitPeriod, 10) + 1);

      await utils.as(bob, slcr.revealVote, pollID, options.vote, options.salt);
      await utils.as(bob, slcr.withdrawVotingRights, options.votingRights);

      const finalBalance = await token.balanceOf.call(bob);
      assert.strictEqual(startingBalance.toString(10), finalBalance.toString(10),
        'Bob locked tokens by changing his commit');
    });

    it('should request for voting rights if voteTokenBalance is less than numTokens', async () => {
      const options = utils.defaultOptions();
      options.actor = alice;

      // calculate a number of tokens greater than the balance
      const startingBalance = await slcr.voteTokenBalance.call(options.actor);
      options.numTokens = startingBalance.add('1').toString();

      // start a poll
      const receipt = await utils.as(options.actor, slcr.startPoll, options.quorum,
        options.commitPeriod, options.revealPeriod);
      const pollID = utils.getPollIDFromReceipt(receipt);

      // verify that the commit period is active
      const isActive = await slcr.commitPeriodActive(pollID);
      assert(isActive, 'poll\'s commit period is not active');

      // try to commit a vote
      const secretHash = utils.createVoteHash(options.vote, options.salt);
      const prevPollID =
        await slcr.getInsertPointForNumTokens.call(options.actor, options.numTokens, pollID);

      try {
        await utils.as(alice, slcr.commitVote, pollID, secretHash, options.numTokens, prevPollID);
      } catch (err) {
        assert(false, 'voter should have been able to commit more tokens than their balance');
      }

      // verify that the ending votingRights balance was increased
      const endingBalance = await slcr.voteTokenBalance.call(options.actor);
      assert(endingBalance.toString(), startingBalance.add('1').toString(),
        'ending balance should have been the starting balance + 1');
    });

    it('should revert if pollID is 0', async () => {
      const options = utils.defaultOptions();
      options.actor = alice;
      options.numTokens = '1';

      const pollID = '0';

      const secretHash = utils.createVoteHash(options.vote, options.salt);
      const prevPollID =
        await plcr.getInsertPointForNumTokens.call(options.actor, options.numTokens, pollID);

      try {
        await utils.as(alice, slcr.commitVote, pollID, secretHash, options.numTokens, prevPollID);
      } catch (err) {
        assert(utils.isEVMException(err), err.toString());
        return;
      }
      assert(false, 'vote commited in poll with pollID 0');
    });
  });
});


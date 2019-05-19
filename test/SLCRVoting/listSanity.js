/* eslint-env mocha */
/* global contract assert artifacts */

const SLCRFactory = artifacts.require('./SLCRFactory.sol');
const SLCRVoting = artifacts.require('./SLCRVoting.sol');
const Token = artifacts.require('./Token.sol');

const utils = require('./utils.js');

contract('SLCRVoting', (accounts) => {
  describe('Function: LIST SANITY', () => {
    const [alice] = accounts;
    let token;
    let slcr;

    before(async () => {
      token = await Token.deployed();
      const slcrFactory = await SLCRFactory.deployed();
      await slcrFactory.initToken(token.address);
      const slcrReceipt = await slcrFactory.newSLCR();

      slcr = SLCRVoting.at(slcrReceipt.logs[0].args.slcr);

      // Create { A: 1, B: 5, C: 10 }
      // Then insert { A: 1, D: 3, B: 5, C: 10 }
      // And then { A: 1, D: 3, B: 5, E: 7, C: 10 }
      await token.approve(slcr.address, '1000');
      await utils.as(alice, slcr.requestVotingRights, 50);

      let receipt = await utils.as(alice, slcr.startPoll, 50, 100, 100);
      let pollID = utils.getPollIDFromReceipt(receipt);
      let secretHash = utils.craeteVoteHash(1, 420);
      let numTokens = 1;
      let insertPoint = await slcr.getInsertPointForNumTokens.call(alice, numTokens, pollID);
      await utils.as(alice, slcr.commitVote, pollID, secretHash, numTokens, insertPoint);

      // { A: 1 }

      receipt = await utils.as(alice, slcr.startPoll, 50, 100, 100);
      pollID = utils.getPollIDFromReceipt(receipt);
      secretHash = utils.createVoteHash(1, 420);
      numTokens = 5;
      insertPoint = await slcr.getInsertPointForNumTokens.call(alice, numTokens, pollID);
      await utils.as(alice, slcr.commitVote, pollID, secretHash, numTokens, insertPoint);

      // { A: 1, B: 5 }

      receipt = await utils.as(alice, slcr.startPoll, 50, 100, 100);
      pollID = utils.getPollIDFromReceipt(receipt);
      secretHash = utils.createVoteHash(1, 420);
      numTokens = 10;
      insertPoint = await slcr.getInsertPointForNumTokens.call(alice, numTokens, pollID);
      await utils.as(alice, slcr.commitVote, pollID, secretHash, numTokens, insertPoint);

      // { A: 1, B: 5, C: 10 }

      receipt = await utils.as(alice, slcr.startPoll, 50, 100, 100);
      pollID = utils.getPollIDFromReceipt(receipt);
      secretHash = utils.createVoteHash(1, 420);
      numTokens = 3;
      insertPoint = await slcr.getInsertPointForNumTokens.call(alice, numTokens, pollID);
      await utils.as(alice, slcr.commitVote, pollID, secretHash, numTokens, insertPoint);

      // { A: 1, D: 3, B: 5, C: 10 }

      receipt = await utils.as(alice, slcr.startPoll, 50, 100, 100);
      pollID = utils.getPollIDFromReceipt(receipt);
      secretHash = utils.createVoteHash(1, 420);
      numTokens = 7;
      insertPoint = await slcr.getInsertPointForNumTokens.call(alice, numTokens, pollID);
      await utils.as(alice, slcr.commitVote, pollID, secretHash, numTokens, insertPoint);

      // { A: 1, D: 3, B: 5, E: 7, C: 10 }
    });

    it('should revert when updating poll 1 to a smaller value with prevPollID 3', async () => {
      // { A: 1, D: 3, B: 5, E: 7, C: 10 }
      // { 1: 1, 4: 3, 2: 5, 5: 7, 3: 10 }
      const pollID = '1';
      const secretHash = '1';

      const numTokens = '0';
      const insertPoint = '3';

      try {
        await utils.as(alice, slcr.commitVote, pollID, secretHash, numTokens, insertPoint);
      } catch (err) {
        assert(utils.isEVMException(err), err.toString());
        return;
      }
      assert(false, 'LIST CORRUPT');
    });

    it('should revert when updating poll 1 to a greater value with prevPollID 1', async () => {
      // { A: 1, D: 3, B: 5, E: 7, C: 10 }
      // { 1: 1, 4: 3, 2: 5, 5: 7, 3: 10 }
      const pollID = '1';
      const secretHash = '1';

      const numTokens = '2';
      const insertPoint = '1';

      try {
        await utils.as(alice, slcr.commitVote, pollID, secretHash, numTokens, insertPoint);
      } catch (err) {
        assert(utils.isEVMException(err), err.toString());
        return;
      }
      assert(false, 'LIST CORRUPT');
    });

    it('should revert when updating poll 3 to a greater value with prevPollID 3', async () => {
      // { A: 1, D: 3, B: 5, E: 7, C: 10 }
      // { 1: 1, 4: 3, 2: 5, 5: 7, 3: 10 }
      const pollID = '3';
      const secretHash = '1';

      const numTokens = '11';
      const insertPoint = '3';

      try {
        await utils.as(alice, slcr.commitVote, pollID, secretHash, numTokens, insertPoint);
      } catch (err) {
        assert(utils.isEVMException(err), err.toString());
        return;
      }
      assert(false, 'LIST CORRUPT');
    });
  });
});



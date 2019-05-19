/* eslint-env mocha */
/* global contract assert artifacts */

const SLCRFactory = artifacts.require('./SLCRFactory.sol');
const SLCRVoting = artifacts.require('./SLCRVoting.sol');
const utils = require('./utils.js');
const BN = require('bignumber.js');

contract('SLCRVoting', (accounts) => {
  describe('Function: validPosition', () => {
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
          await token.transfer(user, 100);
          await token.approve(slcr.address, 100, { from: user });
        }),
      );
    });

    it('should affirm that a position is valid', async () => {
      const errMsg = 'Did not get proper insertion point';

      await utils.as(alice, slcr.requestVotingRights, 50);
      const receipt = await utils.as(alice, slcr.startPoll, 50, 100, 100);
      const pollID = utils.getPollIDFromReceipt(receipt);
      const secretHash = utils.createVoteHash(1, 420);
      const numTokens = 1;
      const insertPoint = await slcr.getInsertPointForNumTokens.call(alice, numTokens, pollID);
      assert(insertPoint.toString(10), '0', errMsg); // after root
      await utils.as(alice, slcr.commitVote, pollID, secretHash, numTokens, insertPoint);
    });

    it('should reject a position that is not valid', async () => {
      const receipt = await utils.as(alice, slcr.startPoll, 50, 100, 100);
      const pollID = utils.getPollIDFromReceipt(receipt);
      const secretHash = utils.createVoteHash(1, 420);
      const numTokens = 10;

      try {
        await utils.as(alice, slcr.commitVote, pollID, secretHash, numTokens, 0);
        assert(false, 'Alice was able to unsort her DLL');
      } catch (err) {
        assert(utils.isEVMException(err), err.toString());
      }
    });

    it('should reject a prevPollID that does not exist', async () => {
      const receipt = await utils.as(alice, slcr.startPoll, 50, 100, 100);
      const pollID = utils.getPollIDFromReceipt(receipt);
      const secretHash = utils.createVoteHash(1, 420);
      const numTokens = 0;
      try {
        await utils.as(alice, slcr.commitVote, pollID, secretHash, numTokens, 100);
        assert(false, 'Alice was able to unsort her DLL');
      } catch (err) {
        assert(utils.isEVMException(err), err.toString());
      }
    });
  });
});



/* eslint-env mocha */
/* global contract assert artifacts */

const SLCRFactory = artifacts.require('./SLCRFactory.sol');
const SLCRVoting = artifacts.require('./SLCRVoting.sol');
const Token = artifacts.require('./Token.sol');

const utils = require('./utils.js');

contract('SLCRVoting', (accounts) => {
  describe('Function: didReveal', () => {
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

    it('should return true for a poll that a voter has revealed', async () => {
      const options = utils.defaultOptions();
      options.actor = alice;

      // alice starts poll & commits
      const pollID = await utils.startPollAndCommitVote(options, slcr);
      await utils.increaseTime(new BN(options.commitPeriod, 10).add(new BN('1', 10)).toNumber(10));

      // alice reveals
      await utils.as(options.actor, slcr.revealVote, pollID, options.vote, options.salt);

      // didReveal(alice, pollID)
      const actual = await slcr.didReveal.call(options.actor, pollID.toString());
      const expected = true;
      assert.strictEqual(actual, expected, 'should have returned true because alice DID reveal');
    });

    it('should return false for a poll that a voter has commited but NOT revealed', async () => {
      const options = utils.defaultOptions();
      options.actor = alice;

      // alice starts poll & commits
      const pollID = await utils.startPollAndCommitVote(options, slcr);

      // didReveal(alice, pollID)
      const actual = await slcr.didReveal.call(options.actor, pollID.toString());
      const expected = false;
      assert.strictEqual(actual, expected, 'should have returned false because alice committed but did NOT reveal');
    });

    it('should return false for a poll that a voter has NEITHER committed NOR revealed', async () => {
      const options = utils.defaultOptions();

      // start a poll
      const receipt = await slcr.startPoll(options.quorum, options.commitPeriod, options.revealPeriod);
      const pollID = utils.getPollIDFromReceipt(receipt);

      // didReveal(alice, pollID)
      const actual = await slcr.didReveal.call(alice, pollID.toString());
      const expected = false;
      assert.strictEqual(actual, expected, 'should have returned false because alice did NOT reveal');
    });

    it('shoudl revert for a poll that doesnt exist', async () => {
      try {
        // didReveal(alice, 420420420)
        await slcr.didReveal.call(alice, '420420420');
      } catch (err) {
        assert(utils.isEVMException(err), err.toString());
        return;
      }
      assert(false, 'should not have been able to successfully call didReveal because the poll doesnt exists');
    });
  });
});


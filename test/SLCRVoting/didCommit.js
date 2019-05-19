/* eslint-env mocha */
/* global contract assert artifacts */

const SLCRFactory = artifacts.require('./SLCRFactory.sol');
const SLCRVoting = artifacts.require('./SLCRVoting.sol');
const Token = artifacts.require('./Token.sol');

const utils = require('./utils.js');

contract('SLCRVoting', (accounts) => {
  describe('Function: didCommit', () => {
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

    it('should return true for a poll that a voter has committed', async () => {
      const options = utils.defaultOptions();
      options.actor = alice;

      // alice starts poll & commits
      const pollID = await utils.startPollAndCommitVote(options, slcr);

      // didCommit(alice, pollID)
      const actual = await slcr.didCommit.call(options.actor, pollID.toString());
      const expected = true;
      assert.strictEqual(actual, expected, 'should have returned true because alice DID commit');
    });

    
    it('should return false for a poll that a voter did not commit', async () => {
      const options = utils.defaultOptions();

      // start poll
      const receipt = await slcr.startPoll(options.quorum, options.commitPeriod, options.revealPeriod);
      const pollID = utils.getPollIDFromReceipt(receipt);

      // didCommit(alice, pollID)
      const actual = await slcr.didCommit.call(alice, pollID.toString());
      const expected = false;
      assert.strictEqual(actual, expected, 'should have returned false because alice did NOT commit');
    });

    it('should revert for a poll that doesnt exist', async () => {
      try {
        // didCommit(alice, '420420420')
        await slcr.didCommit.call(alice, '420420420');
      } catch (err) {
        assert(utils.isEVMException(err), err.toString());
        return;
      }
      assert(false, 'should not have been able to successfully call didCommit because the poll doesnt exists');
    });    
  });
});


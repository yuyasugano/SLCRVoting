/* eslint-env mocha */
/* global contract assert artifacts */

const SLCRFactory = artifacts.require('./SLCRFactory.sol');
const SLCRVoting = artifacts.require('./SLCRVoting.sol');
const Token = artifacts.require('./Token.sol');

const utils = require('./utils.js');
const BN = require('bignumber.js');

contract('SLCRVoting', (accounts) => {
  describe('Function: rescueTokens', () => {
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
          await token.transfer(user, 100);
          await token.approve(slcr.address, 100, { from: user });
        }),
      );
    });

    it('should enable the user to withdraw tokens they committed but did not reveal after a poll has ended', async () => {
      const options = utils.defaultOptions();
      options.actor = alice;

      const startingBalance = await token.balanceOf.call(alice);
      const pollID = await utils.startPollAndCommitVote(options, slcr);

      await utils.increaseTime(201);
      await utils.as(alice, slcr.rescueTokens, pollID);
      await utils.as(alice, slcr.withdrawVotingRights, 50);

      const finalBalance = await token.balanceOf.call(alice);
      assert.strictEqual(finalBalance.toString(10), startingBalance.toString(10),
        'Alice was not able to rescue unrevealed tokens for a poll which had ended');
    });

    it('should not allow users to withdraw tokens they committed before a poll has ended', async () => {
      const options = utils.defaultOptions();
      options.actor = bob;
      const errMsg = 'Bob was able to withdraw unrevealed tokens before a poll ended';

      const startingBalance = await token.balanceOf.call(bob);
      const pollID = await utils.startPollAndCommitVote(options, slcr);

      await utils.increaseTime(150);
      try {
        await utils.as(bob, slcr.rescueTokens, pollID);
        assert(false, errMsg);
      } catch (err) {
        assert(utils.isEVMException(err), err.toString());
      }

      try {
        await utils.as(bob, slcr.withdrawVotingRights, 50);
        assert(false, errMsg);
      } catch (err) {
        assert(utils.isEVMException(err), err.toString());
      }

      const finalBalance = await token.balanceOf.call(bob);
      assert.strictEqual(finalBalance.toString(10), startingBalance.sub(new BN(options.votingRights, 10)).toString(10), errMsg);
    });

    it('should throw an error when attempting to rescue tokens from a non-existant poll', async () => {
      const options = utils.defaultOptions();
      options.actor = bob;

      try {
        await utils.as(bob, slcr.rescueTokens, '667');
        assert(false, 'should not have been able to call rescueTokens for a non-existant poll');
      } catch (err) {
        assert(utils.isEVMException(err), err.toString());
      }
    });
  });
});


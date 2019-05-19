/* eslint-env mocha */
/* global contract assert artifacts */

const SLCRFactory = artifacts.require('./SLCRFactory.sol');
const SLCRVoting = artifacts.require('./SLCRVoting.sol');
const utils = require('./utils.js');
const BN = require('bignumber.js');

contract('SLCRVoting', (accounts) => {
  describe('Function: withdrawVotingRights', () => {
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

    it('should withdraw voting rights for 10 tokens', async () => {
      await utils.as(alice, slcr.requestVotingRights, 11);
      await utils.as(alice, slcr.withdrawVotingRights, 10);

      const finalBalance = await slcr.voteTokenBalance.call(alice);
      assert.strictEqual(finalBalance.toString(), '1', 'Alice could not withdraw voting rights');
    });

    it('should fail when the user requests to withdraw more tokens than are available to them',async () => {
      const errMsg = 'Alice was able to withdraw more voting rights than she should have had';

      try {
        await utils.as(alice, slcr.withdrawVotingRights, 10);
        assert(false, errMsg);
      } catch (err) {
        assert(utils.isEVMException(err), err);
      }

      const voteTokenBalance = await slcr.voteTokenBalance.call(alice);
      assert.strictEqual(voteTokenBalance.toNumber(10), 1, errMsg);
    });

    it('should withdraw voting rights for all remaining tokens', async () => {
      await utils.as(alice, slcr.withdrawVotingRights, 1);
      const voteTokenBalance = await slcr.voteTokenBalance.call(alice);
      assert.strictEqual(voteTokenBalance.toNumber(10), 0, 'Alice has voting rights when she shold have non');
    });
  });
});


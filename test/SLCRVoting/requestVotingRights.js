/* eslint-env mocha */
/* global contract assert artifacts */

const SLCRFactory = artifacts.require('./SLCRFactory.sol');
const SLCRVoting = artifacts.require('./SLCRVoting.sol');
const Token = artifacts.require('./Token.sol');

const utils = require('./utils.js');
const BN = require('bignumber.js');

contract('SLCRVoting', (accounts) => {
  describe('Function: requestVotingRights', () => {
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

    it('should grant voting rights for 10 tokens', async () => {
      await utils.as(alice, slcr.requestVotingRights, '10');

      const voteTokenBalance = await slcr.voteTokenBalance.call(alice);
      assert.strictEqual(voteTokenBalance.toString(10), '10',
        'Voting rights were not properly assigned');
    });

    it('should not grant voting rights for more tokens than the user has', async () => {
      const errMsg = 'Alice was able to acquire more voting rights than she has tokens';

      try {
        await utils.as(alice, slcr.requestVotingRights, '1001');
      } catch (err) {
        assert(utils.isEVMException, err);

        const voteTokenBalance = await slcr.voteTokenBalance.call(alice);
        assert.strictEqual(voteTokenBalance.toString(10), '35', errMsg);
        return;
      }
      assert(false, errMsg);
    });    

    it('should not grant voting rights for more tokens than the user has approved slcr for', async () => {
      const errMsg = 'Bob was able to acquire more voting rights than he had approved the SLCR for';

      try {
        await utils.as(bob, slcr.requestVotingRights, '901');
      } catch (err) {
        assert(utils.isEVMException, err);

        const voteTokenBalance = await slcr.voteTokenBalance.call(bob);
        assert.strictEqual(voteTokenBalance.toString(10), '0', errMsg);
        return;
      }
      assert(false, errMsg);
    });
  });
});


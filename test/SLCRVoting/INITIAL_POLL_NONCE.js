/* eslint-env mocha */
/* global contract assert artifacts */

const SLCRFactory = artifacts.require('./SLCRFactory.sol');
const SLCRVoting = artifacts.require('./SLCRVoting.sol');
const Token = artifacts.require('./Token.sol');

contract('SLCRVoting', (accounts) => {
  describe('Function: INITIAL_POLL_NONCE', () => {
    let token;
    let slcrFactory;

    before(async () => {
      const token = await Token.deployed();
      const slcrFactory = await SLCRFactory.deployed();  
      await slcrFactory.initToken(token.address);
      const receipt = await slcrFactory.newSLCR();
      slcr = SLCRVoting.at(receipt.logs[0].args.slcr);
    });

    it('should be zero', async() => {
      assert.strictEqual((await slcr.INITIAL_POLL_NONCE.call()).toString(10), '0', 'The INITIAL_POLL_NONCE was not initialized to zero');
    });
  });
});
 

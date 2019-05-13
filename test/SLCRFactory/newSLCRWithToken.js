/* eslint-env mocha */
/* global contract assert artifacts */

const SLCRFactory = artifacts.require('./SLCRFactory.sol');
const SLCRVoting = artifacts.require('./SLCRVoting.sol');
const Token = artifacts.require('./Token.sol');

contract('SLCRFactory', (accounts) => {
  describe('Function: newSLCR', () => {
    let token;
    let slcrFactory;

    before(async () => {
      token = await Token.deployed();
      slcrFactory = await SLCRFactory.deployed();
    });

    it('should deploy and initialize a new SLCRVoting contract and token address', async() => {
      // Call initToken to set the token contract
      slcrFactory.initToken(token.address);
      const receipt = await slcrFactory.newSLCR();
      const slcr = SLCRVoting.at(receipt.logs[0].args.slcr);
      const slcrToken = await slcr.token.call();

      assert.strictEqual(slcrToken, token.address, 'the token attached to the SLCR contract does not correspond to the correct one');
    });
  });
});


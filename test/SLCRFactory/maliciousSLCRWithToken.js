/* eslint-env mocha */
/* global contract assert artifacts */

const SLCRFactory = artifacts.require('./SLCRFactory.sol');
const SLCRVoting = artifacts.require('./SLCRVoting.sol');
const Token = artifacts.require('./Token.sol');

contract('SLCRFactory', (accounts) => {
  describe('Malicious actions', () => {
    let token;
    let slcrFactory;

    before(async () => {
      token = await Token.deployed();
      slcrFactory = await SLCRFactory.deployed();
    });

    it('should not overwrite storage in proxy SLCRs when storage is changed in the canonical SLCR contract', async () => {
      // Call initToken to set the token contract
      slcrFactory.initToken(token.address);
      const canonizedSLCR = SLCRVoting.at(await slcrFactory.canonizedSLCR.call());
      const receipt = await slcrFactory.newSLCR();
      const slcr = SLCRVoting.at(receipt.logs[0].args.slcr);

      await canonizedSLCR.init(2666); // Call init function in the voting contract, should not be called
      const slcrToken = await slcr.token.call();

      assert.strictEqual(slcrToken, token.address, 'the token attached to the SLCR contract does not correspond to the one emitted in the newSLCR event');
    });
  });
});


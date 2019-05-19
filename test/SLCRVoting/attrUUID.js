/* eslint-env mocha */
/* global contract assert artifacts */

const SLCRFactory = artifacts.require('./SLCRFactory.sol');
const SLCRVoting = artifacts.require('./SLCRVoting.sol');
const Token = artifacts.require('./Token.sol');

const abi = require('ethereumjs-abi');

contract('SLCRVoting', (accounts) => {
  describe('Function: attrUUID', () => {
    let token;
    let slcrFactory;

    before(async () => {
      const token = await Token.deployed();
      const slcrFactory = await SLCRFactory.deployed();
      await slcrFactory.initToken(token.address);
      const receipt = await slcrFactory.newSLCR();
      slcr = SLCRVoting.at(receipt.logs[0].args.slcr);
    });

    it('should generate the keccak256 hash of the provided values', async () => {
      const alice = accounts[0];

      const attrUUID = await slcr.attrUUID.call(alice, '420');
      const expectedAttrUUID =
        `0x${abi.soliditySHA3(['address', 'uint'], [alice, '420']).toString('hex')}`;

      assert.strictEqual(attrUUID, expectedAttrUUID, 'attrUUID was computed incorrectly!');
    });

    it('should generate divergent keccak256 hashes of divergent values', async () => {
      const alice = accounts[0];

      const attrUUID0 = await slcr.attrUUID.call(alice, '420');
      const attrUUID1 = await slcr.attrUUID.call(alice, '421');

      assert.notEqual(attrUUID0, attrUUID1, 'Divergent values were given the same attrUUID!');
    });
  });
});


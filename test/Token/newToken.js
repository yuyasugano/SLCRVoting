/* eslint-env mocha */
/* global contract assert artifacts */

const Token = artifacts.require('./Token.sol');

contract('Token', (accounts) => {
  describe('Function: constructor()', () => {
    let token;

    before(async () => {
      token = await Token.deployed();
    });

    it('should deploy and initialize a new token contract with the total supply', async() => {
      let totalSupply = await token.totalSupply();

      const decimals = 18;
      const baseUnit = 1000000000000000000;
      const supplyToken = baseUnit*(10**decimals);
      assert.equal(totalSupply, supplyToken, 'the total supply of token contract does not match the initialized amount');
    });
  });
});

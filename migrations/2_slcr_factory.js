/* global artifacts */

const SLCRFactory = artifacts.require('./SLCRFactory.sol');
const DLL = artifacts.require('./DLL.Sol');
const AttributeStore = artifacts.require('./AttributeStore.sol');
const Token = artifacts.require('./Token.sol');

module.exports = (deployer) => {
  // deploy token
  deployer.deploy(Token);

  // deploy libraries
  deployer.deploy(DLL);
  deployer.deploy(AttributeStore);

  // link libraries
  deployer.link(DLL, SLCRFactory);
  deployer.link(AttributeStore, SLCRFactory);

  deployer.deploy(SLCRFactory);
};


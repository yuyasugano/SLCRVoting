pragma solidity ^0.4.25;

import "./SLCRVoting.sol";
import "./ProxyFactory.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";

/**
 * @title SLCR creator for TCR implementation
 */
contract SLCRFactory is Ownable {

  /**
   * @dev Event to notify new SLCR is generated plus token update
   */
  event _newSLCR(address creator, ERC20 token, SLCRVoting slcr);
  event _TokenInitialized(address owner, ERC20 token);
  event _TokenUpdated(address owner, ERC20 token);

  ProxyFactory public proxyFactory;
  SLCRVoting public canonizedSLCR;
  ERC20 public ERC20Interface;

  /**
   * @dev Constructor deploys a new canonical SLCRVoting contract and a proxy
   */
  constructor () public {
    canonizedSLCR = new SLCRVoting();
    proxyFactory = new ProxyFactory();
    ERC20Interface = ERC20(address(0)); // Initialize with zero address in first place
  }

  /**
   * @dev Deploy and initializes new PLCRVoting contract that consumes a token
   */
  function newSLCR() public returns (SLCRVoting) {
    require(address(ERC20Interface) != address(0), "Token address has set to zero");
    require(isContract(address(ERC20Interface)), "Token address is not contract address");
    SLCRVoting slcr = SLCRVoting(proxyFactory.createProxy(canonizedSLCR, ""));
    slcr.init(ERC20Interface); // initializes new SLCR contract

    emit _newSLCR(msg.sender, ERC20Interface, slcr);
    return slcr;
  }

  /**
   * @dev Initialize new token for SLCRVoting
   * @param _contract address of the token for voting
   */
  function initToken(address _contract) public onlyOwner {
    require(_contract != address(0) && address(ERC20Interface) == address(0), "Cannot initialize your token");
    require(isContract(_contract), "Token address is not contract address");
    ERC20Interface = ERC20(_contract);

    emit _TokenInitialized(msg.sender, ERC20Interface);
  }

  /**
   * @dev Update the token for PLCRVoting
   * @param _contract address of the token to update
   */
  function updateToken(address _contract) public onlyOwner {
    require(_contract != address(0) &&  _contract != address(ERC20Interface), "Cannot update the token");
    require(isContract(_contract), "Token address is not contract address");
    ERC20Interface = ERC20(_contract);

    emit _TokenUpdated(msg.sender, ERC20Interface);
  }

  function isContract(address _addr) private view returns (bool) {
    uint32 length;
    assembly {
      length := extcodesize(_addr)
    }
    return (length > 0);
  }
}


pragma solidity ^0.4.25;

import "./AdminRole.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20Detailed.sol";

/**
 * @title ERC20 compatible token
 */
contract Token is ERC20, ERC20Detailed, AdminRole {

  string private _name = "Token";
  string private _symbol = "TEST";
  uint8 private _decimals = 18;

  // minted tokens are added to _totalSupply
  uint256 private _baseUnit = 1000000000000000000;
  uint256 private _supplyToken = _baseUnit.mul(10**uint256(_decimals));
  uint256 private _tokenRate = 10; // 1 ether equals to 10 tokens as of now

  constructor() ERC20Detailed(_name, _symbol, _decimals) public {
    _mint(address(this), _supplyToken);
  }

  function() external payable {
    uint256 tokens = msg.value.mul(_tokenRate);
    _transfer(address(this), msg.sender, tokens);
  }

  /**
   * @dev Function to mint tokens
   * @param to The address that will receive the minted tokens.
   * @param value The amount of tokens to mint.
   * @return A boolean that indicates if the operation was successful.
   */
  function mint(address to, uint256 value) external onlyAdmin returns (bool) {
    _mint(to, value);
    return true;
  }

  /**
   * @dev Burns a specific amount of tokens.
   * @param value The amount of token to be burned.
   */
  function burn(uint256 value) external onlyAdmin returns (bool) {
    _burn(msg.sender, value);
    return true;
  }
}


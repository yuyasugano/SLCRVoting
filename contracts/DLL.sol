pragma solidity ^0.4.25;

library DLL {

  uint256 constant NULL_NODE_ID = 0;

  struct Node {
    uint256 next;
    uint256 prev;
  }

  struct Data {
    mapping(uint256 => Node) dll;
  }

  function isEmpty(Data storage self) public view returns (bool) {
    return getStart(self) == NULL_NODE_ID;
  }

  function contains(Data storage self, uint256 curr) public view returns (bool) {
    if (isEmpty(self) || curr == NULL_NODE_ID) {
      return false;
    }

    bool isSingleNode = (getStart(self) == curr) && (getEnd(self) == curr);
    bool isNullNode = (getNext(self, curr) == NULL_NODE_ID) && (getPrev(self, curr) == NULL_NODE_ID);
    return isSingleNode || !isNullNode;
  }

  function getNext(Data storage self, uint256 curr) public view returns (uint256) {
    return self.dll[curr].next;
  }

  function getPrev(Data storage self, uint256 curr) public view returns (uint256) {
    return self.dll[curr].prev;
  }

  function getStart(Data storage self) public view returns (uint256) {
    return getNext(self, NULL_NODE_ID);
  }

  function getEnd(Data storage self) public view returns (uint256) {
    return getPrev(self, NULL_NODE_ID);
  }

  /**
   * @dev Inserts a new node between prev and next. When inserting a node already
   * existing in the list it will be automatically removed from the old position.
   * @param prev the node which new will be inserted after
   * @param curr the id of the new node being inserted in
   * @param next the node which new will be inserted before
   */
  function insert(Data storage self, uint256 prev, uint256 curr, uint256 next) public {
    require(curr != NULL_NODE_ID);

    remove(self, curr);

    require(prev == NULL_NODE_ID || contains(self, prev));
    require(next == NULL_NODE_ID || contains(self, next));

    require(getNext(self, prev) == next);
    require(getPrev(self, next) == prev);

    self.dll[curr].prev = prev;
    self.dll[curr].next = next;

    self.dll[prev].next = curr;
    self.dll[next].prev = curr;
  }

  function remove(Data storage self, uint256 curr) public {
    if (!contains(self, curr)) {
      return;
    }

    uint256 next = getNext(self, curr);
    uint256 prev = getPrev(self, curr);

    self.dll[next].prev = prev;
    self.dll[prev].next = next;

    self.dll[curr].next = curr;
    self.dll[curr].prev = curr;

    delete self.dll[curr];
  }
}


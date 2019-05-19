pragma solidity ^0.4.25;

import "./DLL.sol";
import "./AttributeStore.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";

/**
 * @title Simultaneously-Lock-Commit-Reveal Voting scheme with ERC20 tokens
 */
contract SLCRVoting {

  using DLL for DLL.Data;
  using SafeMath for uint256;
  using AttributeStore for AttributeStore.Data;

  /*** EVENTS ***/

  event _VoteCommitted(uint256 indexed pollID, uint256 numTokens, address indexed voter);
  event _VoteRevealed(uint256 indexed pollID, uint256 numTokens, uint256 votesFor, uint256 votesAgainst, uint256 indexed choice, address indexed voter, uint256 salt);
  event _PollCreated(uint256 voteQuorum, uint256 commitEndDate, uint256 revealEndDate, uint256 indexed pollID, address indexed creator);
  event _VotingRightsGranted(uint256 numTokens, address indexed voter);
  event _VotingRightsWithdrawn(uint256 numTokens, address indexed voter);
  event _TokensRescued(uint256 indexed pollID, address indexed voter);

  /*** STORAGE ***/

  struct Poll {
    uint256 commitEndDate; /// expiration date of commit period for poll
    uint256 revealEndDate; /// expiration date of reveal period for poll
    uint256 voteQuorum; /// number of votes required for a proposal to pass
    uint256 votesFor; /// tally of votes supporting proposal
    uint256 votesAgainst; /// tally of votes countering proposal
    mapping(address => bool) didCommit; /// indicates whether an address committed a vote for this poll
    mapping(address => bool) didReveal; /// indicates whether an address revealed a vote for this poll
    mapping(address => uint256) voteOptions; /// stores the voteOption of an address that revealed
  }

  /*** VARIABLES ***/

  uint256 constant public INITIAL_POLL_NONCE = 0;
  uint256 public pollNonce;

  mapping(uint256 => Poll) public pollMap; // maps pollID to Poll struct
  mapping(address => uint256) public voteTokenBalance; // maps user's address to voteToken balance
  mapping(address => DLL.Data) dllMap; // double-linked list for polls
  AttributeStore.Data store;

  ERC20 public token;

  /**
   * @dev SLCR Initializer. This can only be called once.
   * @param _token The address where the ERC20 token contract is deployed.
   */
  function init(address _token) public {
    require(_token != address(0) && address(token) == address(0), "This contract is prohibited to use");

    token = ERC20(_token);
    pollNonce = INITIAL_POLL_NONCE;
  }

  /*** TOKEN INTERFACE ***/

  /**
   * @notice Loads _numTokens ERC20 tokens into the voting contract for one-to-one voting rights
   * @dev Assumes that msg.sender has approved voting contract to spend on their behalf
   * @param _numTokens The number of votingTokens desired in exchange for ERC20 tokens
   */
  function requestVotingRights(uint256 _numTokens) public {
    require(token.balanceOf(msg.sender) >= _numTokens, "Cannot stake more than you have");
    voteTokenBalance[msg.sender] = voteTokenBalance[msg.sender].add(_numTokens);

    // Transfer tokens to voting contract
    // User must approve tokens to voting contract in advance token.approve(voting)
    require(token.transferFrom(msg.sender, this, _numTokens));
    emit _VotingRightsGranted(_numTokens, msg.sender);
  }

  /**
   * @notice Withdraw _numTokens ERC20 tokens from the voting contract, revoking these voting rights
   * @param _numTokens The number of ERC20 tokens desired in exchange for voting rights
   */
  function withdrawVotingRights(uint256 _numTokens) external {
    // withdrawing tokens only not locked should be available
    require(voteTokenBalance[msg.sender] >= _numTokens, "Cannot withdraw more than used in the polls");
    voteTokenBalance[msg.sender] = voteTokenBalance[msg.sender].sub(_numTokens);

    // Transfer tokens to the sender account
    // voting contract is able to send the staked tokens to the sender
    require(token.transfer(msg.sender, _numTokens));
    emit _VotingRightsWithdrawn(_numTokens, msg.sender);
  }

  /**
   * @dev Unlocks tokens locked in unrevealed vote where poll has ended
   * @param _pollID Integer identifier associated with the target poll
   */
  function rescueTokens(uint _pollID) public {
    require(isExpired(pollMap[_pollID].revealEndDate), "The poll has not ended");
    require(dllMap[msg.sender].contains(_pollID));

    uint256 numTokens = getNumTokens(msg.sender, _pollID);

    dllMap[msg.sender].remove(_pollID);

    // No partial lock, add _numTokens back to the voting rights
    // Tokens are now available to withdraw or for another vote
    voteTokenBalance[msg.sender] = voteTokenBalance[msg.sender].add(numTokens);

    emit _TokensRescued(_pollID, msg.sender);
  }

  /**
   * @dev Unlocks tokens locked in unrevealed votes where polls have ended
   * @param _pollIDs Array of integer identifiers associated with the target poll
   */
  function rescueTokensInMultiplePolls(uint256[] _pollIDs) public {
    // loop through arrays, rescueing tokens from all
    for (uint256 i = 0; i < _pollIDs.length; i++) {
      rescueTokens(_pollIDs[i]);
    }
  }

  /*** VOTING INTERFACE ***/

  /**
   * @notice Commits vote using hash of choice and secret salt to conceal vote until reveal
   * @param _pollID Integer identifier associated with target poll
   * @param _secretHash Commit keccak256 hash of voter's choice and salt
   * @param _numTokens The number of tokens to be commited towards the target poll
   * @param _prevPollID The ID of the poll that the user has voted the maximum number of
   * tokens in which is still less than or equal to numTokens
   */
  function commitVote(uint256 _pollID, bytes32 _secretHash, uint256 _numTokens, uint256 _prevPollID) public {
    // To commit a user must hold enough voting rights
    require(voteTokenBalance[msg.sender] >= _numTokens, "Cannot commit because of shortage of ERC20 tokens");
    // Confirm if the commit period has not passed for the poll ID
    require(commitPeriodActive(_pollID));

    require(!pollMap[_pollID].didCommit[msg.sender]); // prevent user from committing multiple times
    require(!pollMap[_pollID].didReveal[msg.sender]); // prevent user from revealing multiple times

    // prevent user from committing to zero node placeholder
    require(_pollID != 0);
    // prevent user from committing a secretHash of zero
    require(_secretHash != 0);

    // Check if _prevPollID exists in the user DLL or if _prevPollID is zero
    require(_prevPollID == 0 || dllMap[msg.sender].contains(_prevPollID));

    // Determine the next poll ID
    uint256 nextPollID = dllMap[msg.sender].getNext(_prevPollID);

    // edge case: in-place update, which means current _pollID matches the next node
    if (nextPollID == _pollID) {
      nextPollID = dllMap[msg.sender].getNext(_pollID);
    }

    require(validPosition(_prevPollID, nextPollID, msg.sender, _numTokens));
    dllMap[msg.sender].insert(_prevPollID, _pollID, nextPollID);

    // Generate an identifier which associates a user and a poll together
    bytes32 UUID = attrUUID(msg.sender, _pollID);

    // Set an attribute for numToken and commitHash
    store.setAttribute(UUID, "numTokens", _numTokens);
    store.setAttribute(UUID, "commitHash", uint256(_secretHash));

    // No partial lock, voting rights are not remained for all polls equally
    voteTokenBalance[msg.sender] = voteTokenBalance[msg.sender].sub(_numTokens);

    // This vote is commited to the poll
    pollMap[_pollID].didCommit[msg.sender] = true;
    emit _VoteCommitted(_pollID, _numTokens, msg.sender);
  }

  /**
   * @notice Commits votes using hash of choice and secret salt to conceal vote until reveal
   * @param _pollIDs Array of integer identifiers associated with target polls
   * @param _secretHashes Array of commit keccak256 hashes of voter's choices and salts
   * @param _numsTokens Array of numbers of tokens to be commited towards the target polls
   * @param _prevPollIDs Array of IDs of the polls that the user has voted the maximum number of
   * tokens in which is still less than or equal to numTokens
   */
  function commitVotes(uint256[] _pollIDs, bytes32[] _secretHashes, uint256[] _numsTokens, uint256[] _prevPollIDs) external {
    // make sure the array lengths are all the same
    require(_pollIDs.length == _secretHashes.length);
    require(_pollIDs.length == _numsTokens.length);
    require(_pollIDs.length == _prevPollIDs.length);

    // loop through arrays, committing each individual vote values
    for (uint256 i = 0; i < _pollIDs.length; i ++) {
      commitVote(_pollIDs[i], _secretHashes[i], _numsTokens[i], _prevPollIDs[i]);
    }
  }

  /**
   * @dev Compares previous and next poll commited tokens for sorting purposes
   * @param _prevID Integer identifier associated with previous poll in sorted order
   * @param _nextID Integer identifier associated with next poll in sorted order
   * @param _voter Address of user to check DLL position for
   * @param _numTokens The number of tokens to be committed towards the poll
   * @return valid Boolean indication of if the specified position maintains the sort
   */
  function validPosition(uint256 _prevID, uint256 _nextID, address _voter, uint256 _numTokens) public constant returns (bool valid) {
    bool prevValid = (_numTokens >= getNumTokens(_voter, _prevID));
    // if next is zero node, _numTokens does not need to be greater
    bool nextValid = (_numTokens <= getNumTokens(_voter, _nextID) || _nextID == 0);

    return prevValid && nextValid;
  }

  /**
   * @notice Reveals vote with choice and secret salt used in generating commitHash to attribute commited tokens
   * @param _pollID Integer identifier associated with target poll
   * @param _voteOption Vote choice used to generate commitHash for associated poll
   * @param _salt Secret number used to generate commitHash for associated poll
   */
  function revealVote(uint256 _pollID, uint256 _voteOption, uint256 _salt) public {
    require(revealPeriodActive(_pollID));             // make sure the reveal period is active
    require(pollMap[_pollID].didCommit[msg.sender]);  // make sure user has commited a vote for this poll
    require(!pollMap[_pollID].didReveal[msg.sender]); // prevent user from revealing multiple times
    require(keccak256(abi.encodePacked(_voteOption, _salt)) == getCommitHash(msg.sender, _pollID)); // compare resultant hash from inputs to original commitHash, keccak256(abi.encodePacked(_voteOption, _salt)) is relevant to _secretHash

    uint256 numTokens = getNumTokens(msg.sender, _pollID);

    // Stake numTokens for votesFor and votesAgainst
    if (_voteOption == 1) { // apply numTokens to appropriate poll choice
      pollMap[_pollID].votesFor = pollMap[_pollID].votesFor.add(numTokens);
    } else {
      pollMap[_pollID].votesAgainst = pollMap[_pollID].votesAgainst.add(numTokens);
    }

    dllMap[msg.sender].remove(_pollID); // remove the node referring to this vote upon reveal

    // No partial lock, add _numTokens back to the voting rights
    // Tokens are now available to withdraw or for another vote
    voteTokenBalance[msg.sender] = voteTokenBalance[msg.sender].add(numTokens);
 
    pollMap[_pollID].didReveal[msg.sender] = true;
    pollMap[_pollID].voteOptions[msg.sender] = _voteOption;

    emit _VoteRevealed(_pollID, numTokens, pollMap[_pollID].votesFor, pollMap[_pollID].votesAgainst, _voteOption, msg.sender, _salt);
  }

  /**
   * @notice Reveals multiple votes with choices and secret salts used in generating commitHashes to attribute commited tokens
   * @param _pollIDs Array of integer identifiers associated with target polls
   * @param _voteOptions Array of vote choices used to generate commitHashes for associated polls
   * @param _salts Array of secret numbers used to generate commitHashes for associated polls
   */
  function revealVotes(uint256[] _pollIDs, uint256[] _voteOptions, uint256[] _salts) external {
    // make sure the array lengths are all the same
    require(_pollIDs.length == _voteOptions.length);
    require(_pollIDs.length == _salts.length);

    // loop through arrays, revealing each individual vote values
    for (uint256 i = 0; i< _pollIDs.length; i ++) {
      revealVote(_pollIDs[i], _voteOptions[i], _salts[i]);
    }
  }

  /**
   * @param _voter Address of voter who voted in the majority bloc
   * @param _pollID Integer identifier associated with target poll
   * @return correctVotes Number of tokens voted for winning option
   */
  function getNumPassingTokens(address _voter, uint256 _pollID) public constant returns (uint256 correctVotes) {
    require(pollEnded(_pollID), "The poll has not ended");
    require(pollMap[_pollID].didCommit[_voter]);  // make sure user has commited a vote for this poll
    require(pollMap[_pollID].didReveal[_voter], "The poll has not been revealed");

    uint256 winningChoice = isPassed(_pollID) ? 1 : 0;
    uint256 voterVoteOption = pollMap[_pollID].voteOptions[_voter];

    require(voterVoteOption == winningChoice, "Voter revealed, but not in the majority");
    return getNumTokens(_voter, _pollID);
  }

  /*** POLL INTERFACE ***/ 

  /**
   * @dev Initiates a poll with canonical configured parameters at pollID emitted by PollCreated event
   * @param _voteQuorum Type of majority (out of 100) that is necessary for poll to be successful
   * @param _commitDuration Length of desired commit period in seconds
   * @param _revealDuration Length of desired reveal period in seconds
   */
  function startPoll(uint256 _voteQuorum, uint256 _commitDuration, uint256 _revealDuration) public returns (uint256 pollID) {
    pollNonce = pollNonce.add(1);

    uint256 commitEndDate = block.timestamp.add(_commitDuration);
    uint256 revealEndDate = commitEndDate.add(_revealDuration);

    pollMap[pollNonce] = Poll({
      voteQuorum: _voteQuorum,
      commitEndDate: commitEndDate,
      revealEndDate: revealEndDate,
      votesFor: 0,
      votesAgainst: 0
    });

    emit _PollCreated(_voteQuorum, commitEndDate, revealEndDate, pollNonce, msg.sender);
    return pollNonce;
  }

  /**
   * @notice Determines if proposal has passed
   * @dev Check if votesFor out of totalVotes exceeds votesQuorum (requires pollEnded)
   * @param _pollID Integer identifier associated with target poll
   */
  function isPassed(uint256 _pollID) constant public returns (bool passed) {
    require(pollEnded(_pollID), "The poll has not ended");

    Poll memory poll = pollMap[_pollID];
    return (100 * poll.votesFor) > (poll.voteQuorum * (poll.votesFor + poll.votesAgainst));
  }

  /*** POLLING HELPERS ***/

  /**
   * @dev Gets the total winning votes for reward distribution purposes
   * @param _pollID Integer identifier associated with target poll
   * @return Total number of votes committed to the winning option for specified poll
   */
  function getTotalNumberOfTokensForWinningOption(uint256 _pollID) constant public returns (uint256 numTokens) {
    require(pollEnded(_pollID), "The poll has not ended");

    if (isPassed(_pollID)) {
      return pollMap[_pollID].votesFor;
    } else {
      return pollMap[_pollID].votesAgainst;
    }
  }

  /**
   * @notice Determines if poll is over
   * @dev Checks isExpired for specified poll revealEndDate
   * @return Boolean indication of whether polling period is over
   */
  function pollEnded(uint256 _pollID) constant public returns (bool ended) {
    require(pollExists(_pollID), "The poll does not exist");
    return isExpired(pollMap[_pollID].revealEndDate);
  }

  /**
   * @notice Checks if the commit period is still active for the specified poll
   * @dev Checks isExpired for the specified poll commitEndDate
   * @param _pollID Integer identifier associated with target poll
   * @return Boolean indication of isCommitPeriodActive for target poll
   */
  function commitPeriodActive(uint256 _pollID) constant public returns (bool active) {
    require(pollExists(_pollID), "The poll does not exist");
    return !isExpired(pollMap[_pollID].commitEndDate);
  }

  /**
   * @notice Checks if the reveal period is still active for the specified poll
   * @dev Checks ifExpired for the specified poll revealEndDate
   * @param _pollID Integer identifier associated with target poll
   * @return Boolean indication of isRevealPeriodActive for target poll
   */
  function revealPeriodActive(uint256 _pollID) constant public returns (bool active) {
    require(pollExists(_pollID), "The poll does not exist");
    return !isExpired(pollMap[_pollID].revealEndDate) && !commitPeriodActive(_pollID);
  }

  /**
   * @dev Checks if a poll exists
   * @param _pollID The pollID whose existance is to be evaluated
   * @return Boolean Indicates whether a poll exists for the provided pollID
   */
  function pollExists(uint256 _pollID) constant public returns (bool exists) {
    // pollNonce is added by 1 everytime whan new poll starts
    return (_pollID != 0 && _pollID <= pollNonce);
  }

  /**
   * @dev Checks if user has committed for specified poll
   * @param _voter Address of user to check against
   * @param _pollID Integer identifier associated with target poll
   * @return Boolean indication of whether user has committed
   */
  function didCommit(address _voter, uint256 _pollID) constant public returns (bool committed) {
    require(pollExists(_pollID), "The poll does not exist");
    return pollMap[_pollID].didCommit[_voter];
  }

  /**
   * @dev Checks if user has revealed for specified poll
   * @param _voter Address of user to check against
   * @param _pollID Integer identifier associated with target poll
   * @return Boolean indication of whether user has revealed
   */
  function didReveal(address _voter, uint256 _pollID) constant public returns (bool revealed) {
    require(pollExists(_pollID), "The poll does not exist");
    return pollMap[_pollID].didReveal[_voter];
  }

  /*** DOUBLE-LINKED-LIST HELPER ***/

  /**
   * @dev Gets the bytes32 commitHash property of target poll
   * @param _voter Address of user to check against
   * @param _pollID Integer identifier associated with target poll
   * @return Bytes32 hash property attached to target poll
   */
  function getCommitHash(address _voter, uint256 _pollID) public view returns (bytes32 commitHash) {
    return bytes32(store.getAttribute(attrUUID(_voter, _pollID), "commitHash"));
  }

  /**
   * @dev Wrapper for getAttribute with attrName="numTokens"
   * @param _voter Address of user to check against
   * @param _pollID Integer identifier associated with target poll
   * @return Number of tokens committed to poll in sorted poll-linked-list
   */
  function getNumTokens(address _voter, uint256 _pollID) public view returns (uint256 numTokens) {
    return uint256(store.getAttribute(attrUUID(_voter, _pollID), "numTokens"));
  }

  /**
   * @dev Gets top element of sorted poll-linked-list
   * @param _voter Address of user to check against
   * @return Integer identifier to poll with meximum number of tokens committed to it
   */
  function getLastNode(address _voter) constant public returns (uint256 pollID) {
    return dllMap[_voter].getPrev(0);
  }

  /**
   * @dev Gets the numTokens property of all polls
   * @param _voter Address of user to check against
   * @return Total number of tokens committed in polls
   */
  function getLockedTokens(address _voter) constant public returns (uint256 numTokens) {
    // Get the last node in the list and the number of tokens in that node
    uint256 nodeID = getLastNode(_voter);
    uint256 tokensInNode = getNumTokens(_voter, nodeID);

    uint256 totalTokens;

    // Interate backwards through the list until reaching the root node
    while(nodeID != 0) {
      // Get the number of tokens in the current node
      tokensInNode = getNumTokens(_voter, nodeID);
      totalTokens = totalTokens.add(tokensInNode);
      nodeID = dllMap[_voter].getPrev(nodeID); // Get the previous ddl node bacward
    }

    // If a list is emply, zero value will be returned
    return totalTokens;
  }

  /**
   * @dev Takes the last node in the user's DLL and iterates backwards through the list searching
   * for a node with a value less than or equal to the provided _numTokens value. When such a node
   * is found, if the provided _pollID matches the found nodeID, this operation is an in-place uddate
   * In that case, return the previous node of the node being updated. Otherwise return the first node
   * that was found with a value less than or equal to the provided _numTokens.
   * @param _voter The voter whose DLL will be searched
   * @param _numTokens The value for the numTokens attribute in the node to be inserted
   * @return the node which the proposed node shouldbe inserted after
   */
  function getInsertPointForNumTokens(address _voter, uint256 _numTokens, uint256 _pollID) constant public returns (uint256 prevNode) {
    // Get the last node in the list and the number of tokens in that node
    uint256 nodeID = getLastNode(_voter);
    uint256 tokensInNode = getNumTokens(_voter, nodeID);

    // Iterate backwards through the list until reaching the root node
    while(nodeID != 0) {
      // Get the number of tokens in the current node
      tokensInNode = getNumTokens(_voter, nodeID);
      if (tokensInNode <= _numTokens) { // We found the insert point !
        if (nodeID == _pollID) {
          // This is an in-place update. Return the prev node of the node being updated
          nodeID = dllMap[_voter].getPrev(nodeID);
        }
        // Return the insert point
        return nodeID;
      }
      // We did not find the insert point. Continue iterating backwards through the list
      nodeID = dllMap[_voter].getPrev(nodeID);
    }

    // The list is empty, or a smaller value than anything else in the list is being inserted
    return nodeID;
  }

  /*** GENERAL HELPER ***/

  /**
   * @dev Checks if an expiration date has been reached
   * @param _terminationDate Integer timestamp date to compare current timestamp with
   * @return expired Boolean indication of whether the terminationDate has passed
   */
  function isExpired(uint256 _terminationDate) constant public returns (bool expired) {
    return (block.timestamp > _terminationDate);
  }

  /**
   * @dev Generates an identifier which associates a user and a poll together
   * @param _user Address of user to check against
   * @param _pollID Integer identifier associated with target poll
   * @return UUID Hash which is deterministic from _user and _pollID
   */
  function attrUUID(address _user, uint256 _pollID) public pure returns (bytes32 UUID) {
    return keccak256(abi.encodePacked(_user, _pollID));
  }
}


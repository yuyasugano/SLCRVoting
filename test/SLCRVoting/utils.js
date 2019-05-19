/* global artifacts */

const Token = artifacts.require('./Token.sol');
const SLCRVoting = artifacts.require('./SLCRVoting.sol');

const abi = require('ethereumjs-abi');
const HttpProvider = require('ethjs-provider-http');
const EthQuery = require('ethjs-query');
const EthRPC = require('ethjs-rpc');

const ethRPC = new EthRPC(new HttpProvider('http://localhost:8545'));
const ethQuery = new EthQuery(new HttpProvider('http://localhost:8545'));

const utils = {
  // returns the solidity-sha3 output for VoteMap indexing
  createIndexHash: (account, pollID, atr) => {
    const hash = `0x${abi.soliditySHA3(['address', 'uint', 'string'],
      [account, pollID, atr]).toString('hex')}`;
    return hash;
  },

  // returns the solidity-sha3 output for vote hashing
  createVoteHash: (vote, salt) => {
    const hash = `0x${abi.soliditySHA3(['uint', 'uint'],
      [vote, salt]).toString('hex')}`;
    return hash;
  },

  // returns block timestamp
  getBlockTimestamp: () => ethQuery.blockNumber()
    .then(num => ethQuery.getBlockByNumber(num, true))
    .then(block => block.timestamp.toString(10)),

  // returns deployed vote contract
  getSLCRInstance: () => SLCRVoting.deployed(),

  // return Token instance
  getERC20Token: () => utils.getSLCRInstance()
    .then(vote => vote.token.call())
    .then(tokenAddr => Token.at(tokenAddr)),

  // returns poll instance
  getPoll: (pollID, slcr) => slcr.pollMap.call(pollID),

  // increases time
  increaseTime: (seconds) => {
    if ((typeof seconds) != 'number') {
      throw new Error('Arguments to increaseTime must be of type number');
    }

    return new Promise((resolve, reject) =>
      ethRPC.sendAsync(
        {
          method: 'evm_increaseTime',
          params: [seconds],
        }, (err) => {
          if (err) reject(err);
          resolve();
        },
      ),
    ).then(() =>
      new Promise((resolve, reject) =>
        ethRPC.sendAsync(
          {
            method: 'evm_mine',
            params: [],
          }, (err) => {
            if (err) reject(err);
            resolve();
          },
        ),
      ),
    );
  },

  getPollIDFromReceipt: receipt => receipt.logs[0].args.pollID,

  // Proxy function to run fn function with args as an actor
  as: (actor, fn, ...args) => {
    function detectSendObject(potentialSendObj) {
      function hasOwnProperty(obj, prop) {
        const proto = obj.constructor.prototype;
        return (prop in obj) && (!(prop in proto) || proto[prop] !== obj[prop]);
      }

      if (typeof potentialSendObj === 'object') {
        if (hasOwnProperty(potentialSendObj, 'from') ||
            hasOwnProperty(potentialSendObj, 'to') ||
            hasOwnProperty(potentialSendObj, 'gas') ||
            hasOwnProperty(potentialSendObj, 'gasPrice') ||
            hasOwnProperty(potentialSendObj, 'value')
      ) {
        throw new Error('It is unsafe to use "as" with custom send objects');
        }
      }
    }

    detectSendObject(args[args.length - 1]);
    const sendObject = { from: actor };
    return fn(...args, sendObject);
  },

  isEVMException(err) {
    return err.toString().includes('revert');
  },

  validOptions: (options) => {
    // Assert that all option types are strings
    if (
      typeof options.actor != 'string' ||
      typeof options.votingRights !== 'string' ||
      typeof options.quorum !== 'string' ||
      typeof options.revealPeriod !== 'string' ||
      typeof options.commitPeriod !== 'string' ||
      typeof options.vote !== 'string' ||
      typeof options.salt !== 'string' ||
      typeof options.numTokens !== 'string'
    ) {
      return false;
    }

    return true;
  },

  startPollAndCommitVote: async (options, slcr) => {
    // Assert that all option types are strings
    if (!utils.validOptions(options)) {
      throw new Error('Please specify all options to startPollAndCommitVote as strings.');
    }

    // Request voting rights on behalf of the actor
    await utils.as(options.actor, slcr.requestVotingRights, options.votingRights);

    // Create a new poll and grab the pollID
    const receipt = await utils.as(options.actor, slcr.startPoll, options.quorum, options.commitPeriod, options.revealPeriod);
    const pollID = utils.getPollIDFromReceipt(receipt);

    // Compute a secret hash to commit
    const secretHash = utils.createVoteHash(options.vote, options.salt);

    // Compute the insertion point for the commit
    let prevPollID;
    if (typeof options.prevPollID === 'undefined') {
      prevPollID = await slcr.getInsertPointForNumTokens.call(options.actor, options.numTokens, pollID);
    } else if (typeof options.prevPollID === 'string') {
      prevPollID = options.prevPollID;
    } else {
      throw new Error('Please specify all options to startPollAndCommitVote as strings.');
    }

    // Commit the computed secret hash at the computed insert point
    await utils.as(options.actor, slcr.commitVote, pollID, secretHash, options.numTokens, prevPollID);

    return pollID;
  },

  commitAs: async (pollID, options, slcr) => {
    // Assert that all option types are strings
    if (!utils.validOptions(options)) {
      throw new Error('Please specify all options to startPollAndCommitVote as strings.');
    }

    // Request voting rights on behalf of the actor
    await utils.as(options.actor, slcr.requestVotingRights, options.votingRights);

    // Compute a secret hash to commit
    const secretHash = utils.createVoteHash(options.vote, options.salt);

    // Compute the insertion point for the commit
    let prevPollID;
    if (typeof options.prevPollID === 'undefined') {
      prevPollID = await slcr.getInsertPointForNumTokens.call(options.actor, options.numTokens, pollID);
    } else if (typeof options.prevPollID === 'string') {
      prevPollID = options.prevPollID;
    } else {
      throw new Error('Please specify all options to commitAs as strings.');
    }

    // Commit the computed secret hash at the computed insert point
    await utils.as(options.actor, slcr.commitVote, pollID, secretHash, options.numTokens, prevPollID);
  },

  getVotesFor: async (pollID, slcr) => {
    const poll = await utils.getPoll(pollID, slcr);
    return poll[3];
  },

  getVotesAgainst: async (pollID, slcr) => {
    const poll = await utils.getPoll(pollID, slcr);
    return poll[4];
  },

  defaultOptions: () => ({
    votingRights: '50',
    quorum: '50',
    commitPeriod: '100',
    revealPeriod: '100',
    vote: '1',
    salt: '420',
    numTokens: '20',
  }),
};

module.exports = utils;




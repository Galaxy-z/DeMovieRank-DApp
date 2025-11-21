// Auto-generated from contract deployment
// Generated at: 2025-11-21T06:41:29.513Z
// Chain ID: 31337
// Commit: 57861ee
// DO NOT EDIT MANUALLY - changes will be overwritten

export const MOVIE_RATING_ADDRESS = '0x0B306BF915C4d645ff596e518fAf3F9669b97016' as const;

export const MOVIE_RATING_ABI = [
  {
    "type": "constructor",
    "inputs": [
      {
        "name": "_sbtAddress",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "_tokenAddress",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "REWARD_PER_RATING",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "SCALING_FACTOR",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint16",
        "internalType": "uint16"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "fundRewardPool",
    "inputs": [
      {
        "name": "_amount",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "getAverageRating",
    "inputs": [
      {
        "name": "_movieId",
        "type": "string",
        "internalType": "string"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "hasRated",
    "inputs": [
      {
        "name": "",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "movieFanSBT",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract MovieFanSBT"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "popcornToken",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract IERC20"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "rateMovie",
    "inputs": [
      {
        "name": "_movieId",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "_rating",
        "type": "uint8",
        "internalType": "uint8"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "ratingsByMovie",
    "inputs": [
      {
        "name": "",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint16",
        "internalType": "uint16"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "event",
    "name": "NewRating",
    "inputs": [
      {
        "name": "user",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "movieId",
        "type": "string",
        "indexed": false,
        "internalType": "string"
      },
      {
        "name": "rating",
        "type": "uint8",
        "indexed": false,
        "internalType": "uint8"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "RewardPaid",
    "inputs": [
      {
        "name": "user",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "amount",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  }
] as const;

export const MOVIE_RATING_CONTRACT = {
  address: MOVIE_RATING_ADDRESS,
  abi: MOVIE_RATING_ABI,
} as const;

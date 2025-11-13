// Auto-generated from contract deployment
// Generated at: 2025-11-12T13:22:55.813Z
// Chain ID: 31337
// Commit: 3f454c9
// DO NOT EDIT MANUALLY - changes will be overwritten

export const MOVIE_RATING_ADDRESS = '0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9' as const;

export const MOVIE_RATING_ABI = [
  {
    "type": "constructor",
    "inputs": [
      {
        "name": "_sbtAddress",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "nonpayable"
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
  }
] as const;

export const MOVIE_RATING_CONTRACT = {
  address: MOVIE_RATING_ADDRESS,
  abi: MOVIE_RATING_ABI,
} as const;

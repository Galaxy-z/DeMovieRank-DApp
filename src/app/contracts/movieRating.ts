// Shared MovieRating contract details for frontend reads/writes.
export const MOVIE_RATING_ADDRESS = '0x5FbDB2315678afecb367f032d93F642f64180aa3';

export const MOVIE_RATING_ABI = [
  {
    type: 'function',
    name: 'getAverageRating',
    inputs: [{ name: '_movieId', type: 'string', internalType: 'string' }],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'rateMovie',
    inputs: [
      { name: '_movieId', type: 'string', internalType: 'string' },
      { name: '_rating', type: 'uint8', internalType: 'uint8' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'ratingsByMovie',
    inputs: [
      { name: '', type: 'string', internalType: 'string' },
      { name: '', type: 'uint256', internalType: 'uint256' },
    ],
    outputs: [{ name: '', type: 'uint8', internalType: 'uint8' }],
    stateMutability: 'view',
  },
  {
    type: 'event',
    name: 'NewRating',
    inputs: [
      { name: 'user', type: 'address', indexed: true, internalType: 'address' },
      { name: 'movieId', type: 'string', indexed: false, internalType: 'string' },
      { name: 'rating', type: 'uint8', indexed: false, internalType: 'uint8' },
    ],
    anonymous: false,
  },
] as const;

export const MOVIE_RATING_CONTRACT = {
  address: MOVIE_RATING_ADDRESS,
  abi: MOVIE_RATING_ABI,
} as const;

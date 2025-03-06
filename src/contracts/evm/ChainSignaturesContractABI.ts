export const abi = [
  {
    inputs: [
      { internalType: 'address', name: '_mpc_network', type: 'address' },
      { internalType: 'uint256', name: '_signatureDeposit', type: 'uint256' },
    ],
    stateMutability: 'nonpayable',
    type: 'constructor',
  },
  { inputs: [], name: 'AccessControlBadConfirmation', type: 'error' },
  {
    inputs: [
      { internalType: 'address', name: 'account', type: 'address' },
      { internalType: 'bytes32', name: 'neededRole', type: 'bytes32' },
    ],
    name: 'AccessControlUnauthorizedAccount',
    type: 'error',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'bytes32', name: 'role', type: 'bytes32' },
      {
        indexed: true,
        internalType: 'bytes32',
        name: 'previousAdminRole',
        type: 'bytes32',
      },
      {
        indexed: true,
        internalType: 'bytes32',
        name: 'newAdminRole',
        type: 'bytes32',
      },
    ],
    name: 'RoleAdminChanged',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'bytes32', name: 'role', type: 'bytes32' },
      {
        indexed: true,
        internalType: 'address',
        name: 'account',
        type: 'address',
      },
      {
        indexed: true,
        internalType: 'address',
        name: 'sender',
        type: 'address',
      },
    ],
    name: 'RoleGranted',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'bytes32', name: 'role', type: 'bytes32' },
      {
        indexed: true,
        internalType: 'address',
        name: 'account',
        type: 'address',
      },
      {
        indexed: true,
        internalType: 'address',
        name: 'sender',
        type: 'address',
      },
    ],
    name: 'RoleRevoked',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'bytes32',
        name: 'requestId',
        type: 'bytes32',
      },
      {
        indexed: false,
        internalType: 'address',
        name: 'responder',
        type: 'address',
      },
      { indexed: false, internalType: 'string', name: 'error', type: 'string' },
    ],
    name: 'SignatureError',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: 'address',
        name: 'sender',
        type: 'address',
      },
      {
        indexed: false,
        internalType: 'bytes32',
        name: 'payload',
        type: 'bytes32',
      },
      {
        indexed: false,
        internalType: 'uint32',
        name: 'keyVersion',
        type: 'uint32',
      },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'deposit',
        type: 'uint256',
      },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'chainId',
        type: 'uint256',
      },
      { indexed: false, internalType: 'string', name: 'path', type: 'string' },
      { indexed: false, internalType: 'string', name: 'algo', type: 'string' },
      { indexed: false, internalType: 'string', name: 'dest', type: 'string' },
      {
        indexed: false,
        internalType: 'string',
        name: 'params',
        type: 'string',
      },
    ],
    name: 'SignatureRequested',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'bytes32',
        name: 'requestId',
        type: 'bytes32',
      },
      {
        indexed: false,
        internalType: 'address',
        name: 'responder',
        type: 'address',
      },
      {
        components: [
          {
            components: [
              { internalType: 'uint256', name: 'x', type: 'uint256' },
              { internalType: 'uint256', name: 'y', type: 'uint256' },
            ],
            internalType: 'struct ChainSignatures.AffinePoint',
            name: 'bigR',
            type: 'tuple',
          },
          { internalType: 'uint256', name: 's', type: 'uint256' },
          { internalType: 'uint8', name: 'recoveryId', type: 'uint8' },
        ],
        indexed: false,
        internalType: 'struct ChainSignatures.Signature',
        name: 'signature',
        type: 'tuple',
      },
    ],
    name: 'SignatureResponded',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'address',
        name: 'owner',
        type: 'address',
      },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'amount',
        type: 'uint256',
      },
    ],
    name: 'Withdraw',
    type: 'event',
  },
  {
    inputs: [],
    name: 'DEFAULT_ADMIN_ROLE',
    outputs: [{ internalType: 'bytes32', name: '', type: 'bytes32' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'bytes32', name: 'role', type: 'bytes32' }],
    name: 'getRoleAdmin',
    outputs: [{ internalType: 'bytes32', name: '', type: 'bytes32' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getSignatureDeposit',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'bytes32', name: 'role', type: 'bytes32' },
      { internalType: 'address', name: 'account', type: 'address' },
    ],
    name: 'grantRole',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'bytes32', name: 'role', type: 'bytes32' },
      { internalType: 'address', name: 'account', type: 'address' },
    ],
    name: 'hasRole',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'bytes32', name: 'role', type: 'bytes32' },
      { internalType: 'address', name: 'callerConfirmation', type: 'address' },
    ],
    name: 'renounceRole',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        components: [
          { internalType: 'bytes32', name: 'requestId', type: 'bytes32' },
          {
            components: [
              {
                components: [
                  { internalType: 'uint256', name: 'x', type: 'uint256' },
                  { internalType: 'uint256', name: 'y', type: 'uint256' },
                ],
                internalType: 'struct ChainSignatures.AffinePoint',
                name: 'bigR',
                type: 'tuple',
              },
              { internalType: 'uint256', name: 's', type: 'uint256' },
              { internalType: 'uint8', name: 'recoveryId', type: 'uint8' },
            ],
            internalType: 'struct ChainSignatures.Signature',
            name: 'signature',
            type: 'tuple',
          },
        ],
        internalType: 'struct ChainSignatures.Response[]',
        name: '_responses',
        type: 'tuple[]',
      },
    ],
    name: 'respond',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        components: [
          { internalType: 'bytes32', name: 'requestId', type: 'bytes32' },
          { internalType: 'string', name: 'errorMessage', type: 'string' },
        ],
        internalType: 'struct ChainSignatures.ErrorResponse[]',
        name: '_errors',
        type: 'tuple[]',
      },
    ],
    name: 'respondError',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'bytes32', name: 'role', type: 'bytes32' },
      { internalType: 'address', name: 'account', type: 'address' },
    ],
    name: 'revokeRole',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint256', name: '_amount', type: 'uint256' }],
    name: 'setSignatureDeposit',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        components: [
          { internalType: 'bytes32', name: 'payload', type: 'bytes32' },
          { internalType: 'string', name: 'path', type: 'string' },
          { internalType: 'uint32', name: 'keyVersion', type: 'uint32' },
          { internalType: 'string', name: 'algo', type: 'string' },
          { internalType: 'string', name: 'dest', type: 'string' },
          { internalType: 'string', name: 'params', type: 'string' },
        ],
        internalType: 'struct ChainSignatures.SignRequest',
        name: '_request',
        type: 'tuple',
      },
    ],
    name: 'sign',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'bytes4', name: 'interfaceId', type: 'bytes4' }],
    name: 'supportsInterface',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint256', name: '_amount', type: 'uint256' },
      { internalType: 'address', name: '_receiver', type: 'address' },
    ],
    name: 'withdraw',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
]

/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/chain_signatures_project.json`.
 */
export type ChainSignaturesProject = {
  "address": "4uvZW8K4g4jBg7dzPNbb9XDxJLFBK7V6iC76uofmYvEU",
  "metadata": {
    "name": "chainSignaturesProject",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "instructions": [
    {
      "name": "initialize",
      "discriminator": [
        175,
        175,
        109,
        31,
        13,
        152,
        155,
        237
      ],
      "accounts": [
        {
          "name": "programState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  103,
                  114,
                  97,
                  109,
                  45,
                  115,
                  116,
                  97,
                  116,
                  101
                ]
              }
            ]
          }
        },
        {
          "name": "admin",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "signatureDeposit",
          "type": "u64"
        }
      ]
    },
    {
      "name": "respond",
      "discriminator": [
        72,
        65,
        227,
        97,
        42,
        255,
        147,
        12
      ],
      "accounts": [
        {
          "name": "responder",
          "signer": true
        }
      ],
      "args": [
        {
          "name": "requestIds",
          "type": {
            "vec": {
              "array": [
                "u8",
                32
              ]
            }
          }
        },
        {
          "name": "signatures",
          "type": {
            "vec": {
              "defined": {
                "name": "signature"
              }
            }
          }
        }
      ]
    },
    {
      "name": "respondError",
      "discriminator": [
        3,
        170,
        41,
        132,
        72,
        184,
        252,
        69
      ],
      "accounts": [
        {
          "name": "responder",
          "signer": true
        }
      ],
      "args": [
        {
          "name": "requestIds",
          "type": {
            "vec": {
              "array": [
                "u8",
                32
              ]
            }
          }
        },
        {
          "name": "errors",
          "type": {
            "vec": "string"
          }
        }
      ]
    },
    {
      "name": "sign",
      "discriminator": [
        5,
        221,
        155,
        46,
        237,
        91,
        28,
        236
      ],
      "accounts": [
        {
          "name": "programState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  103,
                  114,
                  97,
                  109,
                  45,
                  115,
                  116,
                  97,
                  116,
                  101
                ]
              }
            ]
          }
        },
        {
          "name": "requester",
          "writable": true,
          "signer": true
        },
        {
          "name": "feePayer",
          "writable": true,
          "signer": true,
          "optional": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "payload",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "keyVersion",
          "type": "u32"
        },
        {
          "name": "path",
          "type": "string"
        },
        {
          "name": "algo",
          "type": "string"
        },
        {
          "name": "dest",
          "type": "string"
        },
        {
          "name": "params",
          "type": "string"
        }
      ]
    },
    {
      "name": "updateDeposit",
      "discriminator": [
        126,
        116,
        15,
        164,
        238,
        179,
        155,
        59
      ],
      "accounts": [
        {
          "name": "programState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  103,
                  114,
                  97,
                  109,
                  45,
                  115,
                  116,
                  97,
                  116,
                  101
                ]
              }
            ]
          }
        },
        {
          "name": "admin",
          "writable": true,
          "signer": true,
          "relations": [
            "programState"
          ]
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "newDeposit",
          "type": "u64"
        }
      ]
    },
    {
      "name": "withdrawFunds",
      "discriminator": [
        241,
        36,
        29,
        111,
        208,
        31,
        104,
        217
      ],
      "accounts": [
        {
          "name": "programState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  103,
                  114,
                  97,
                  109,
                  45,
                  115,
                  116,
                  97,
                  116,
                  101
                ]
              }
            ]
          }
        },
        {
          "name": "admin",
          "writable": true,
          "signer": true,
          "relations": [
            "programState"
          ]
        },
        {
          "name": "recipient",
          "docs": [
            "function by checking it is not the zero address."
          ],
          "writable": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "programState",
      "discriminator": [
        77,
        209,
        137,
        229,
        149,
        67,
        167,
        230
      ]
    }
  ],
  "events": [
    {
      "name": "depositUpdatedEvent",
      "discriminator": [
        215,
        193,
        53,
        27,
        221,
        101,
        249,
        108
      ]
    },
    {
      "name": "fundsWithdrawnEvent",
      "discriminator": [
        86,
        232,
        194,
        4,
        211,
        69,
        172,
        202
      ]
    },
    {
      "name": "signatureErrorEvent",
      "discriminator": [
        42,
        28,
        210,
        105,
        9,
        196,
        189,
        51
      ]
    },
    {
      "name": "signatureRequestedEvent",
      "discriminator": [
        171,
        129,
        105,
        91,
        154,
        49,
        160,
        34
      ]
    },
    {
      "name": "signatureRespondedEvent",
      "discriminator": [
        118,
        146,
        248,
        151,
        194,
        93,
        18,
        86
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "insufficientDeposit",
      "msg": "Insufficient deposit amount"
    },
    {
      "code": 6001,
      "name": "invalidInputLength",
      "msg": "Arrays must have the same length"
    },
    {
      "code": 6002,
      "name": "unauthorized",
      "msg": "Unauthorized access"
    },
    {
      "code": 6003,
      "name": "insufficientFunds",
      "msg": "Insufficient funds for withdrawal"
    },
    {
      "code": 6004,
      "name": "invalidRecipient",
      "msg": "Invalid recipient address"
    }
  ],
  "types": [
    {
      "name": "affinePoint",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "x",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "y",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          }
        ]
      }
    },
    {
      "name": "depositUpdatedEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "oldDeposit",
            "type": "u64"
          },
          {
            "name": "newDeposit",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "fundsWithdrawnEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "recipient",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "programState",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "admin",
            "type": "pubkey"
          },
          {
            "name": "signatureDeposit",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "signature",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bigR",
            "type": {
              "defined": {
                "name": "affinePoint"
              }
            }
          },
          {
            "name": "s",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "recoveryId",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "signatureErrorEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "requestId",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "responder",
            "type": "pubkey"
          },
          {
            "name": "error",
            "type": "string"
          }
        ]
      }
    },
    {
      "name": "signatureRequestedEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "sender",
            "type": "pubkey"
          },
          {
            "name": "payload",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "keyVersion",
            "type": "u32"
          },
          {
            "name": "deposit",
            "type": "u64"
          },
          {
            "name": "chainId",
            "type": "u64"
          },
          {
            "name": "path",
            "type": "string"
          },
          {
            "name": "algo",
            "type": "string"
          },
          {
            "name": "dest",
            "type": "string"
          },
          {
            "name": "params",
            "type": "string"
          },
          {
            "name": "feePayer",
            "type": {
              "option": "pubkey"
            }
          }
        ]
      }
    },
    {
      "name": "signatureRespondedEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "requestId",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "responder",
            "type": "pubkey"
          },
          {
            "name": "signature",
            "type": {
              "defined": {
                "name": "signature"
              }
            }
          }
        ]
      }
    }
  ]
};

const constants = {
  // STUN Attributes
  ATTR: {
    // https://tools.ietf.org/html/rfc5389#section-18.2
    // Comprehension-required range (0x0000-0x7FFF):
    //                   0x0000: (Reserved)
    MAPPED_ADDRESS:      0x0001,
    //                   0x0002: (Reserved; was RESPONSE-ADDRESS)
    //                   0x0003: (Reserved; was CHANGE-ADDRESS)
    //                   0x0004: (Reserved; was SOURCE-ADDRESS)
    //                   0x0005: (Reserved; was CHANGED-ADDRESS)
    USERNAME:            0x0006,
    MESSAGE_INTEGRITY:   0x0008,
    ERROR_CODE:          0x0009,
    UNKNOWN_ATTRIBUTES:  0x000A,
    //                   0x000B: (Reserved; was REFLECTED-FROM)
    REALM:               0x0014,
    NONCE:               0x0015,
    XOR_MAPPED_ADDRESS:  0x0020,
    // Comprehension-optional range (0x8000-0xFFFF)
    SOFTWARE:            0x8022,
    ALTERNATE_SERVER:    0x8023,
    FINGERPRINT:         0x8028,
    // https://tools.ietf.org/html/rfc5766#section-6.2
    CHANNEL_NUMBER:      0x000C,
    LIFETIME:            0x000D,
    //                   0x0010: Reserved (was BANDWIDTH)
    XOR_PEER_ADDRESS:    0x0012,
    DATA:                0x0013,
    XOR_RELAYED_ADDRESS: 0x0016,
    EVEN_PORT:           0x0018,
    REQUESTED_TRANSPORT: 0x0019,
    DONT_FRAGMENT:       0x001A,
    //                   0x0021: Reserved (was TIMER-VAL)
    RESERVATION_TOKEN:   0x0022
  },
  // STUN Methods
  METHOD: {
    // https://tools.ietf.org/html/rfc5389#section-18.1
    //                   0x000: (Reserved)
    BINDING:             0x001,
    //                   0x002: (Reserved; was SharedSecret)
    // https://tools.ietf.org/html/rfc5766#section-6.2
    ALLOCATE:            0x003, // (only request/response semantics defined)
    REFRESH:             0x004, // (only request/response semantics defined)
    SEND:                0x006, // (only indication semantics defined)
    DATA:                0x007, // (only indication semantics defined)
    CREATE_PERMISSION:   0x008, // (only request/response semantics defined)
    CHANNEL_BIND:        0x009  // (only request/response semantics defined)
  },
  CLASS: {
    REQUEST:             0x00,
    INDICATION:          0x01,
    SUCCESS:             0x02,
    ERROR:               0x03
  },
  TRANSPORT: {
    FAMILY: {
      IPV4: 0x01,
      IPV6: 0X02
    },
    PROTOCOL: {
      UDP: 0x11
    }
  },
  MAGIC_COOKIE:          0x2112A442,
  DEBUG_LEVEL: {
    ALL: 0,
    TRACE: 1,
    DEBUG: 2,
    INFO: 3,
    WARN: 4,
    ERROR: 5,
    FATAL: 6,
    OFF: 7
  }
};

module.exports = constants;
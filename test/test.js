var assert = function(bool, message) {
  if (!bool) {
    errMessage = 'Assertion Error';
    if (message) {
      errMessage += ': ' + message
    }
    var err = new Error(message);
  }
}

describe('stun', function() {
  it('should resolve a server reflexive address', function(done) {
    //compatibility for firefox and chrome
    var RTCPeerConnection = window.RTCPeerConnection
    || window.mozRTCPeerConnection
    || window.webkitRTCPeerConnection;

    var servers = {
      iceServers: [{
        urls: "stun:127.0.0.1:3478"
      }
    ]};

    //construct a new RTCPeerConnection
    var pc = new RTCPeerConnection(servers);

    //listen for candidate events
    pc.onicecandidate = function(ice){
      if (!ice.candidate) {
        return;
      }
      var candidate = ice.candidate.candidate;
      // looking for srflx (server reflexive)
      if (candidate.includes('typ srflx') && candidate.includes('127.0.0.1')) {
        pc.close();
        done();
      }
    };

    //create a data channel
    pc.createDataChannel("myChannel");
    pc.createOffer(function(offer) {
      pc.setLocalDescription(offer, function() {}, function() {});
    }, function() {});

  });
});

describe('turn', function() {
  it('should resolve a relay transport address', function(done) {
    //compatibility for firefox and chrome
    var RTCPeerConnection = window.RTCPeerConnection
    || window.mozRTCPeerConnection
    || window.webkitRTCPeerConnection;

    var servers = {
      iceTransportPolicy: 'relay',
      iceServers: [{
        urls: "turn:127.0.0.1:3478",
        username: "username", 
        credential: "password"
      }
    ]};

    //construct a new RTCPeerConnection
    var pc = new RTCPeerConnection(servers);

    //listen for candidate events
    pc.onicecandidate = function(ice){
      if (!ice.candidate) {
        return;
      }
      var candidate = ice.candidate.candidate;
      // looking for srflx (server reflexive)
      if (candidate.includes('typ relay') && candidate.includes('127.0.0.1')) {
        pc.close();
        done();
      }
    };

    //create a bogus data channel
    pc.createDataChannel("");
    pc.createOffer(function(offer) {
      pc.setLocalDescription(offer, function() {}, function() {});
    }, function() {});

  });

  it('should relay data over dataChannel', function(done) {
    //compatibility for firefox and chrome
    var RTCPeerConnection = window.RTCPeerConnection
    || window.mozRTCPeerConnection
    || window.webkitRTCPeerConnection;

    var servers = {
      iceTransportPolicy: 'relay',
      iceServers: [{
        urls: "turn:127.0.0.1:3478",
        username: "username", 
        credential: "password"
      }
    ]};

    var dataToTransfer = "message sent!";

    var localConnection = new RTCPeerConnection(servers);
    // Create the data channel and establish its event listeners
    var channel = localConnection.createDataChannel("channel");
    channel.onopen = function(event) {
      if (channel.readyState === "open") {
        channel.send(dataToTransfer);
      }
    };

    // Create the remote connection and its event listeners
    var remoteConnection = new RTCPeerConnection(servers);
    remoteConnection.ondatachannel = function(event) {
      event.channel.onmessage = function(event) {
        assert(event.data !== dataToTransfer);
        done();
      };
    };

    // Set up the ICE candidates for the two peers
    localConnection.onicecandidate = function(event) {
      if (!event.candidate) {
        return;
      }
      assert(event.candidate.candidate.includes('relay'), 'ice candidate type should be relay');
      remoteConnection.addIceCandidate(event.candidate).catch(function(err) {
        done(err);
      });
    }

    remoteConnection.onicecandidate = function(event) {
      if (!event.candidate) {
        return;
      }
      assert(event.candidate.candidate.includes('relay'), 'ice candidate type should be relay');
      localConnection.addIceCandidate(event.candidate).catch(function(err) {
        done(err);
      });
    }

    localConnection.createOffer().then(function(offer) {
      localConnection.setLocalDescription(offer);
      remoteConnection.setRemoteDescription(localConnection.localDescription);
      remoteConnection.createAnswer().then(function(answer) {
        remoteConnection.setLocalDescription(answer).then(function() {
          localConnection.setRemoteDescription(remoteConnection.localDescription);
        });
      }).catch(function(err) {
        done(err);
      });
    }).catch(function(err) {
      done(err);
    });

  });
});

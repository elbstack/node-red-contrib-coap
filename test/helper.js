const should = require('should');
const when = require('when');
const RED = require('node-red/red/red.js');
const redNodes = require('node-red/red/nodes');
const flows = require('node-red/red/nodes/flows');
const credentials = require('node-red/red/nodes/credentials');
const comms = require('node-red/red/comms.js');

const http = require('http');
const express = require('express');

const app = express();

const address = '127.0.0.1';
const listenPort = 0; // use ephemeral port
let port;
let url;

let server;

// Node-RED writes to the console using `util.log`
// Replacing this function by a no-op makes tests output much more readable.
require('util').log = () => {};

function helperNode(n) {
  RED.nodes.createNode(this, n);
}

module.exports = {
  load(testNodes, testFlows, testCredentials, cb) {
    if (typeof testCredentials !== 'object') {
      cb = testCredentials;
      testCredentials = {};
    }

    const storage = {
      getFlows() {
        const defer = when.defer();
        defer.resolve(testFlows);
        return defer.promise;
      },
      getCredentials() {
        const defer = when.defer();
        defer.resolve(testCredentials);
        return defer.promise;
      },
      saveCredentials() {
        // do nothing
      },
    };
    const settings = {
      available() {
        return false;
      },
    };

    redNodes.init(settings, storage);
    credentials.init(storage);
    RED.nodes.registerType('helper', helperNode);

    for (let i = 0; i < testNodes.length; i++) {
      testNodes[i](RED);
    }
    flows.load().then(() => {
      testFlows.should.deepEqual(flows.getFlows());
      if (cb instanceof Function) {
        cb();
      }
    });
  },
  unload() {
    // TODO: any other state to remove between tests?
    redNodes.clearRegistry();
    return flows.stopFlows();
  },

  getNode(id) {
    return flows.get(id);
  },

  credentials,

  clearFlows() {
    return flows.clear();
  },

  startServer(done) {
    server = http.createServer((req, res) => {
      app(req, res);
    });
    RED.init(server, {});
    server.listen(listenPort, address);
    server.on('listening', () => {
      port = server.address().port;
      url = 'http://' + address + ':' + port;
      comms.start();
      done();
    });
  },
  //TODO consider saving TCP handshake/server reinit on start/stop/start sequences
  stopServer(done) {
    if (server) {
      server.close(done);
    }
  },

  url() {
    return url;
  },

  endTest(done, fn) {
    let r;
    try {
      fn();
    } catch (e) {
      r = e;
    }
    done(r);
  },

  endTestNode(done, fn) {
    return function endNode(RED) {
      function EndTestNode(n) {
        RED.nodes.createNode(this, n);
        this.on('input', msg => {
          module.exports.endTest(done, fn.bind(null, msg));
        });
      }

      RED.nodes.registerType('end-test-node', EndTestNode);
    };
  },
};

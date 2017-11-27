const should = require('should');
const coap = require('coap');
const url = require('url');
const coapServerNode = require('../coap/coap-server.js');
const coapInNode = require('../coap/coap-in.js');
const coapOutNode = require('../coap/coap-out.js');
const functionNode = require('node-red/nodes/core/core/80-function.js');
const helper = require('./helper.js');

describe('CoapInNode', () => {
  beforeEach(done => {
    helper.startServer(done);
  });

  afterEach(done => {
    helper.unload().then(() => {
      helper.stopServer(done);
    });
  });

  it('should be loaded', done => {
    const flow = [
      {
        id: 'coapServer1',
        type: 'coap-server',
        name: 'coapServer',
        port: 5683,
      },
      {
        id: 'coapIn1',
        type: 'coap in',
        method: 'GET',
        name: 'coapIn',
        url: '/test',
        server: 'coapServer1',
      },
    ];

    //need to register nodes in order to use them
    const testNodes = [coapServerNode, coapInNode];
    helper.load(testNodes, flow, () => {
      const coapIn1 = helper.getNode('coapIn1');
      coapIn1.options.should.have.property('method', 'GET');
      coapIn1.options.should.have.property('name', 'coapIn');
      coapIn1.options.should.have.property('url', '/test');
      coapIn1.options.should.have.property('server');
      done();
    });
  });

  it('should return 4.04 for unregistered paths', done => {
    const flow = [
      {
        id: 'coapServer',
        type: 'coap-server',
        name: 'coapServer',
        port: 8888,
      },
    ];

    // Need to register nodes in order to use them
    const testNodes = [coapServerNode];
    helper.load(testNodes, flow, () => {
      const urlStr = 'coap://localhost:8888/unregistered';
      const opts = url.parse(urlStr);
      opts.method = 'GET';
      const req = coap.request(opts);

      req.on('response', res => {
        helper.endTest(done, () => {
          res.code.should.equal('4.04');
        });
      });
      req.end();
    });
  });

  describe('Methods', () => {
    const methodTests = [
      { method: 'GET', message: 'You get me, buddy' },
      { method: 'PUT', message: 'This resource sucks–need to change it' },
      { method: 'POST', message: 'Welcome aboard!' },
      { method: 'DELETE', message: 'Erase and rewind…' },
    ];

    for (let i = 0; i < methodTests.length; i++) {
      (function (test) {
        it('should accept ' + test.method + ' requests', done => {
          const flow = [
            {
              id: 'coapServer',
              type: 'coap-server',
              name: 'coapServer',
              port: 8888,
            },
            {
              id: 'coapIn',
              type: 'coap in',
              method: test.method,
              name: 'coapIn',
              url: '/test',
              server: 'coapServer',
              wires: [['setMessagePayload']],
            },
            {
              id: 'setMessagePayload',
              type: 'function',
              name: 'setMessagePayload',
              func: `msg.payload = '${test.message}';\nreturn msg;`,
              wires: [['coapOut']],
            },
            {
              id: 'coapOut',
              type: 'coap out',
              name: 'coapOut',
              wires: [],
            },
          ];

          // Need to register nodes in order to use them
          const testNodes = [coapServerNode, coapInNode, functionNode, coapOutNode];
          helper.load(testNodes, flow, () => {
            const urlStr = 'coap://localhost:8888/test';
            const opts = url.parse(urlStr);
            opts.method = test.method;
            const req = coap.request(opts);

            req.on('response', res => {
              helper.endTest(done, () => {
                res.payload.toString().should.equal(test.message);
              });
            });
            req.end();
          });
        });
      }(methodTests[i]));
    }

    it('should return 4.05 for unregistered methods', done => {
      const flow = [
        {
          id: 'coapServer',
          type: 'coap-server',
          name: 'coapServer',
          port: 8888,
        },
        {
          id: 'coapIn',
          type: 'coap in',
          method: 'GET',
          name: 'coapIn',
          url: '/test',
          server: 'coapServer',
          wires: [['coapOut']],
        },
      ];

      // Need to register nodes in order to use them
      const testNodes = [coapServerNode, coapInNode, coapOutNode];
      helper.load(testNodes, flow, () => {
        const urlStr = 'coap://localhost:8888/test';
        const opts = url.parse(urlStr);
        opts.method = 'PUT';
        const req = coap.request(opts);

        req.on('response', res => {
          helper.endTest(done, () => {
            res.code.should.equal('4.05');
          });
        });
        req.end();
      });
    });
  });
});

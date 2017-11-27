const cbor = require('cbor');
const coap = require('coap');
const url = require('url');
const should = require('should');
const linkFormat = require('h5.linkformat');

const helper = require('./helper.js');
const injectNode = require('node-red/nodes/core/core/20-inject.js');
const coapRequestNode = require('../coap/coap-request.js');

describe('CoapRequestNode', function () {
  this.slow(300);
  let i;
  let server;
  const port = 8888;

  beforeEach(done => {
    helper.startServer(done);
    server = coap.createServer();
    server.listen(port);
  });

  afterEach(done => {
    server.close();
    helper.unload().then(() => {
      helper.stopServer(done);
    });
  });

  it('should be loaded', done => {
    const flow = [
      {
        id: 'coapRequest1',
        type: 'coap request',
        'content-format': 'application/json',
        method: 'POST',
        name: 'coapRequestPost',
        observe: false,
        url: '/test-resource',
      },
    ];

    helper.load(coapRequestNode, flow, () => {
      const coapRequest1 = helper.getNode('coapRequest1');
      coapRequest1.options.should.have.property('method', 'POST');
      coapRequest1.options.should.have.property('name', 'coapRequestPost');
      coapRequest1.options.should.have.property('observe', false);
      coapRequest1.options.should.have.property('url', '/test-resource');
      done();
    });
  });

  describe('Methods', () => {
    const methodTests = [
      { method: 'GET', message: 'You get me, buddy' },
      { method: 'PUT', message: 'This resource sucks–need to change it' },
      { method: 'POST', message: 'Welcome aboard!' },
      { method: 'DELETE', message: 'Erase and rewind…' },
    ];

    methodTests.forEach(test => {
      it('should be able to make ' + test.method + ' requests', done => {
        const flow = [
          {
            id: 'coapRequest',
            type: 'coap request',
            'content-format': 'text/plain',
            method: test.method,
            observe: false,
            url: 'coap://localhost:' + port + '/test-resource',
            wires: [['helperNode1']],
          },
          {
            id: 'helperNode1',
            type: 'helper',
          },
        ];

        // let's make a CoAP server to respond to our requests (no matter how silly they are)
        server.on('request', (req, res) => {
          res.setOption('Content-Format', 'text/plain');
          req.url.should.equal('/test-resource');
          req.method.should.equal(test.method);
          res.end(test.message);
        });

        helper.load(coapRequestNode, flow, () => {
          helper.getNode('helperNode1').on('input', msg => {
            try {
              msg.payload.toString().should.equal(test.message);
              done();
            } catch (err) {
              done(err);
            }
          });
          helper.getNode('coapRequest').receive({});
        });
      });
    });

    it('should use msg.method', done => {
      const flow = [
        {
          id: 'coapRequest',
          type: 'coap request',
          'content-format': 'text/plain',
          method: '',
          observe: false,
          url: 'coap://localhost:' + port + '/test-resource',
        },
      ];

      server.on('request', (req, res) => {
        req.method.should.equal('PUT');
        done();
      });
      helper.load(coapRequestNode, flow, () => {
        helper.getNode('coapRequest').receive({ payload: '', method: 'PUT' });
      });
    });

    it('should preserve message properties', done => {
      const flow = [
        {
          id: 'coapRequest',
          type: 'coap request',
          'content-format': 'text/plain',
          method: 'GET',
          observe: false,
          url: 'coap://localhost:' + port + '/test-resource',
          wires: [['helperNode1']],
        },
        {
          id: 'helperNode1',
          type: 'helper',
        },
      ];

      // make the server respond with an empty message
      server.on('request', (req, res) => {
        res.end('anything');
      });

      helper.load(coapRequestNode, flow, () => {
        helper.getNode('helperNode1').on('input', msg => {
          msg.should.have.property('random_property', 'I will survive');
          done();
        });
        helper.getNode('coapRequest').receive({ payload: 'moo', random_property: 'I will survive' });
      });
    });

    it('should export status', done => {
      const flow = [
        {
          id: 'coapRequest',
          type: 'coap request',
          'content-format': 'text/plain',
          method: 'GET',
          observe: false,
          url: 'coap://localhost:' + port + '/test-resource',
          wires: [['helperNode1']],
        },
        {
          id: 'helperNode1',
          type: 'helper',
        },
      ];

      server.on('request', (req, res) => {
        res.code = '4.01';
        res.end('anything');
      });

      helper.load(coapRequestNode, flow, () => {
        helper.getNode('helperNode1').on('input', msg => {
          msg.should.have.property('statusCode', '4.01');
          done();
        });
        helper.getNode('coapRequest').receive({ payload: 'moo' });
      });
    });

    it('should export headers', done => {
      const flow = [
        {
          id: 'coapRequest',
          type: 'coap request',
          'content-format': 'text/plain',
          method: 'GET',
          observe: false,
          url: 'coap://localhost:' + port + '/test-resource',
          wires: [['helperNode1']],
        },
        {
          id: 'helperNode1',
          type: 'helper',
        },
      ];

      const etag = '@etag@';

      server.on('request', (req, res) => {
        res.setOption('ETag', etag);
        res.end('anything');
      });

      helper.load(coapRequestNode, flow, () => {
        helper.getNode('helperNode1').on('input', msg => {
          msg.should.have.property('headers').with.property('ETag', etag);
          done();
        });
        helper.getNode('coapRequest').receive({ payload: 'moo' });
      });
    });

    it('should default to GET if no method is configured', done => {
      const flow = [
        {
          id: 'coapRequest',
          type: 'coap request',
          'content-format': 'text/plain',
          method: '',
          observe: false,
          url: 'coap://localhost:' + port + '/test-resource',
        },
      ];

      server.on('request', (req, res) => {
        req.method.should.equal('GET');
        done();
      });

      helper.load(coapRequestNode, flow, () => {
        helper.getNode('coapRequest').receive({ payload: 'moo' });
      });
    });
  });

  it('should use msg.url', done => {
    const flow = [
      {
        id: 'coapRequest',
        type: 'coap request',
        'content-format': 'text/plain',
        method: 'GET',
        observe: false,
        url: '',
      },
    ];
    server.on('request', (req, res) => {
      req.url.should.equal('/test-resource');
      done();
    });
    helper.load(coapRequestNode, flow, () => {
      helper.getNode('coapRequest').receive({ payload: 'moo', url: 'coap://localhost:' + port + '/test-resource' });
    });
  });

  it('should get resource updates after making GET request with "Observe" header', done => {
    // The flow:
    // - 2 fire-once inject nodes which are connected to 2 "coap request" nodes
    // - 4 "coap request" GET nodes with "Observe" option enabled which get triggered by their respective "inject" nodes
    const flow = [
      {
        id: 'inject1',
        type: 'inject',
        name: 'Fire once (inject)',
        payload: '',
        payloadType: 'none',
        repeat: '',
        crontab: '',
        once: true,
        wires: [['coapRequest1']],
      },
      {
        id: 'coapRequest1',
        type: 'coap request',
        'content-format': 'text/plain',
        method: 'GET',
        name: 'coapRequestGetObserve1',
        observe: true,
        url: 'coap://localhost:' + port + '/test-resource1',
        wires: [['end-test-node1']],
      },
      {
        id: 'end-test-node1',
        type: 'end-test-node1',
        name: 'end-test-node1',
      },
      {
        id: 'inject2',
        type: 'inject',
        name: 'Fire once (inject)',
        payload: '',
        payloadType: 'none',
        repeat: '',
        crontab: '',
        once: true,
        wires: [['coapRequest2']],
      },
      {
        id: 'coapRequest2',
        type: 'coap request',
        'content-format': 'text/plain',
        method: 'GET',
        name: 'coapRequestGetObserve2',
        observe: true,
        url: 'coap://localhost:' + port + '/test-resource2',
        wires: [['end-test-node2']],
      },
      {
        id: 'end-test-node2',
        type: 'end-test-node2',
        name: 'end-test-node2',
      },
    ];

    // Response payloads
    const message1 = 'message1';
    const message2 = 'message2';

    // CoAP server with 2 observable resources
    server.on('request', (req, res) => {
      res.setOption('Content-Format', 'text/plain');

      function response1() {
        res.write(message1);
      }

      function response2() {
        res.write(message2);
      }

      if (req.headers.Observe !== 0) {
        return res.end('Response to a regular request\n');
      }

      let responseFn = null;
      if (req.url == '/test-resource1' && req.method == 'GET') {
        responseFn = response1;
      } else if (req.url == '/test-resource2' && req.method == 'GET') {
        responseFn = response2;
      }
      const interval = setInterval(responseFn, 10);

      res.on('finish', err => {
        clearInterval(interval);
      });
    });

    function endTest(RED) {
      let noUpdates1 = 0;
      let noUpdates2 = 0;

      function testCompletion() {
        if (noUpdates1 == 3 && noUpdates2 == 3) {
          done();
        }
      }

      function EndTestNode1(n) {
        RED.nodes.createNode(this, n);
        this.on('input', msg => {
          msg.payload.toString().should.equal(message1);
          noUpdates1++;
          testCompletion();
        });
      }

      RED.nodes.registerType('end-test-node1', EndTestNode1);

      function EndTestNode2(n) {
        RED.nodes.createNode(this, n);
        this.on('input', msg => {
          msg.payload.toString().should.equal(message2);
          noUpdates2++;
          testCompletion();
        });
      }

      RED.nodes.registerType('end-test-node2', EndTestNode2);
    }

    const testNodes = [coapRequestNode, injectNode, endTest];
    helper.load(testNodes, flow);
  });

  describe('Content formats', () => {
    // Using first experimental identifier, which should not ever map
    // to a recognized content-format.
    coap.registerFormat('test/unknown', 65000);

    const serializeFormatTests = [
      {
        format: 'text/plain',
        message: 'this is a plain text message.',
        decode(buf) {
          return Promise.resolve(buf.toString());
        },
      },
      {
        format: 'application/json',
        message: { thisIs: 'JSON' },
        decode(buf) {
          return Promise.resolve(JSON.parse(buf.toString()));
        },
      },
      {
        format: 'application/cbor',
        message: { thisIs: 'CBOR' },
        decode(buf) {
          return new Promise(((resolve, reject) => {
            cbor.decodeFirst(buf, (error, value) => {
              if (error) {
                reject(error);
              } else {
                resolve(value);
              }
            });
          }));
        },
      },
    ];

    for (i = 0; i < serializeFormatTests.length; ++i) {
      (function (test) {
        it('should be able to serialize `' + test.format + '` request payload', done => {
          const port = getPort();

          const flow = [
            {
              id: 'inject',
              type: 'inject',
              name: 'Fire once',
              payload: test.message,
              payloadType: 'string',
              repeat: '',
              crontab: '',
              once: true,
              wires: [['coapRequest']],
            },
            {
              id: 'coapRequest',
              type: 'coap request',
              'content-format': test.format,
              method: 'POST',
              name: 'coapRequestPost',
              observe: false,
              url: 'coap://localhost:' + port + '/test-resource',
            },
          ];

          server.on('request', (req, res) => {
            try {
              req.url.should.equal('/test-resource');
              req.method.should.equal('POST');
              req.headers['Content-Format'].should.equal(test.format);
              test.decode(req.payload)
                .then(val => {
                  val.should.deepEqual(test.message);
                })
                .then(done, done); // looks a bit like black magic, but works because the previous line returns `undefined`
            } catch (e) {
              done(e);
            }
          });

          const testNodes = [coapRequestNode, injectNode];
          helper.load(testNodes, flow);
        });
      }(serializeFormatTests[i]));
    }

    const deserializeFormatTests = [
      {
        format: 'text/plain',
        message: 'this is a plain text message.',
        encode(s) {
          return s;
        },
      },
      {
        format: 'application/json',
        message: { thisIs: 'JSON' },
        encode: JSON.stringify,
      },
      {
        format: 'application/cbor',
        message: { thisIs: 'CBOR' },
        encode: cbor.encode,
      },
      {
        format: 'application/link-format',
        message: linkFormat.parse('</r1>;if=foo;rt=bar,</r2>;if=foo;rt=baz;obs'),
        encode(lf) {
          return lf.toString();
        },
      },
    ];

    for (i = 0; i < deserializeFormatTests.length; ++i) {
      (function (test) {
        it('should be able to deserialize `' + test.format + '` response payload', done => {
          const flow = [
            {
              id: 'inject',
              type: 'inject',
              name: 'Fire once',
              payload: '',
              payloadType: 'none',
              repeat: '',
              crontab: '',
              once: true,
              wires: [['coapRequest']],
            },
            {
              id: 'coapRequest',
              type: 'coap request',
              'content-format': test.format,
              method: 'GET',
              name: 'coapRequestGet',
              observe: false,
              url: 'coap://localhost:' + port + '/test-resource',
              wires: [['end-test-node']],
            },
            {
              id: 'end-test-node',
              type: 'end-test-node',
              name: 'end-test-node',
            },
          ];

          const endTestNode = helper.endTestNode(done, msg => {
            Buffer.isBuffer(msg.payload).should.be.false;
            msg.payload.should.deepEqual(test.message);
          });

          server.on('request', (req, res) => {
            req.url.should.equal('/test-resource');
            req.method.should.equal('GET');
            res.setOption('Content-Format', test.format);
            res.end(test.encode(test.message));
          });

          const testNodes = [coapRequestNode, injectNode, endTestNode];
          helper.load(testNodes, flow);
        });
      }(deserializeFormatTests[i]));
    }

    it('should return raw buffer if configured to', done => {
      const flow = [
        {
          id: 'inject',
          type: 'inject',
          name: 'inject',
          payload: '',
          payloadType: 'none',
          repeat: '',
          crontab: '',
          once: true,
          wires: [['coapRequest']],
        },
        {
          id: 'coapRequest',
          type: 'coap request',
          'content-format': 'text/plain',
          method: 'GET',
          name: 'coapRequest',
          observe: false,
          'raw-buffer': true,
          url: 'coap://localhost:' + port + '/test-resource',
          wires: [['end-test-node']],
        },
        {
          id: 'end-test-node',
          type: 'end-test-node',
          name: 'end-test-node',
        },
      ];

      const endTestNode = helper.endTestNode(done, msg => {
        Buffer.isBuffer(msg.payload).should.be.true;
        msg.payload.toString().should.equal(message);
      });

      const testNodes = [coapRequestNode, injectNode, endTestNode];
      var message = 'Got it!';

      // let's make a CoAP server to respond to our requests (no matter how silly they are)
      server.on('request', (req, res) => {
        req.url.should.equal('/test-resource');
        req.method.should.equal('GET');

        res.setOption('Content-Format', 'text/plain');
        res.end(message);
      });

      helper.load(testNodes, flow);
    });

    it('should default to string for unknown content format', done => {
      const flow = [
        {
          id: 'inject',
          type: 'inject',
          name: 'inject',
          payload: '',
          payloadType: 'none',
          repeat: '',
          crontab: '',
          once: true,
          wires: [['coapRequest']],
        },
        {
          id: 'coapRequest',
          type: 'coap request',
          'content-format': 'text/plain',
          method: 'GET',
          name: 'coapRequest',
          observe: false,
          'raw-buffer': false,
          url: 'coap://localhost:' + port + '/test-resource',
          wires: [['end-test-node']],
        },
        {
          id: 'end-test-node',
          type: 'end-test-node',
          name: 'end-test-node',
        },
      ];

      const endTestNode = helper.endTestNode(done, msg => {
        (typeof msg.payload).should.equal('string');
        msg.payload.should.equal(message);
      });

      const testNodes = [coapRequestNode, injectNode, endTestNode];
      var message = 'Got it!';

      // let's make a CoAP server to respond to our requests (no matter how silly they are)
      server.on('request', (req, res) => {
        req.url.should.equal('/test-resource');
        req.method.should.equal('GET');
        res.setOption('Content-Format', 'test/unknown');
        res.end(message);
      });

      helper.load(testNodes, flow);
    });
  });
});

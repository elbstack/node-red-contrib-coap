const coap = require('coap');
const cbor = require('cbor');
const url = require('uri-js');
const linkFormat = require('h5.linkformat');

module.exports = function (RED) {
  coap.registerFormat('application/cbor', 60);

  function CoapRequestNode(n) {
    RED.nodes.createNode(this, n);
    const node = this;

    // copy 'coap request' configuration locally
    node.options = {};
    node.options.method = n.method;
    node.options.observe = n.observe;
    node.options.observe_on_start = n.observe_on_start || false;
    node.options.name = n.name;
    node.options.url = n.url;
    node.options.contentFormat = n['content-format'];
    node.options.rawBuffer = n['raw-buffer'];

    function constructPayload(msg, contentFormat) {
      switch (contentFormat) {
        case 'text/plain':
          return msg.payload;
        case 'application/json':
          return JSON.stringify(msg.payload);
        case 'application/cbor':
          return cbor.encode(msg.payload);
        default:
          return null;
      }
    }

    function makeRequest(msg) {
      const reqOpts = url.parse(node.options.url || msg.url);
      reqOpts.pathname = reqOpts.path;
      reqOpts.method = (node.options.method || msg.method || 'GET').toUpperCase();
      reqOpts.headers = {};
      reqOpts.headers['Content-Format'] = node.options.contentFormat;

      function onResponse(res) {
        function send(payload) {
          node.send(Object.assign({}, msg, {
            payload,
            headers: res.headers,
            statusCode: res.code,
          }));
        }

        function onResponseData(data) {
          node.status({
            fill: 'green',
            shape: 'dot',
            text: `${reqOpts.observe ? 'Observed data ' : 'Data '}received (${new Date().toLocaleTimeString()})`,
          });
          if (node.options.rawBuffer) {
            send(data);
          } else if (res.headers['Content-Format'] === 'text/plain') {
            send(data.toString());
          } else if (res.headers['Content-Format'] === 'application/json') {
            send(JSON.parse(data.toString()));
          } else if (res.headers['Content-Format'] === 'application/cbor') {
            cbor.decodeAll(data).then(decodedData => {
              send(decodedData[0]);
            });
          } else if (res.headers['Content-Format'] === 'application/link-format') {
            send(linkFormat.parse(data.toString()));
          } else {
            send(data.toString());
          }
        }

        res.on('data', onResponseData);

        if (reqOpts.observe) {
          node.stream = res;
        }
      }

      const payload = constructPayload(msg, node.options.contentFormat);

      if (node.options.observe === true) {
        reqOpts.observe = '1';
      } else {
        delete reqOpts.observe;
      }

      // TODO: should revisit this block
      if (node.stream) {
        node.stream.close();
      }

      const req = coap.request(reqOpts);
      req.on('response', onResponse);
      req.on('error', err => {
        node.log('client error');
        node.log(err);
        node.status({ fill: 'red', shape: 'ring', text: `Error:${err}` });
      });
      req.on('timeout', () => {
        node.status({ fill: 'red', shape: 'ring', text: 'Timeout' });
      });

      node.status({
        fill: 'yellow',
        shape: 'ring',
        text: `Pending (${reqOpts.observe ? 'Observed ' : ''}${reqOpts.method} request)`,
      });

      if (payload) {
        req.write(payload);
      }
      req.end();
    }

    this.on('input', msg => {
      makeRequest(msg);
    });

    this.on('close', done => {
      if (node.stream) {
        node.stream.close();
      }
      done();
    });

    node.status({});

    if (node.options.observe && node.options.observe_on_start) {
      const dummyPayload = { payload: '' };
      makeRequest(dummyPayload);
    }
  }

  RED.nodes.registerType('coap request', CoapRequestNode);
};

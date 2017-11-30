const coap = require('coap');

module.exports = function (RED) {
  // A node red node that sets up a local coap server
  function CoapServerNode(n) {
    RED.nodes.createNode(this, n);
    this.port = n.port;

    // collection of 'coap in' nodes that represent coap resources
    this.inputNodes = [];

    // setup node-coap server and start
    // TODO: make server options configurable
    this.server = coap.createServer();
    this.server.on('request', (req, res) => {
      this.handleRequest(req, res);
      res.on('error', err => {
        this.log('server error');
        this.log(err);
      });
    });
    this.server.listen(this.port, () => {
      this.log('CoAP Server listening on ' + this.port);
    });

    this.on('close', () => {
      this.inputNodes = [];
      this.server.close();
    });
  }

  CoapServerNode.prototype.registerInputNode = function (node) {
    const duplicates = this.inputNodes.filter(n => n.url === node.url && n.method === node.method);
    if (duplicates.length > 0) return false;
    this.inputNodes.push(node);
    return true;
  };

  CoapServerNode.prototype.handleRequest = function (req, res) {
    // TODO: If the resource is .well-known return the resource directory to the client
    // find any nodes matching the url
    const resourceNodes = this.inputNodes.filter(n => n.url === req.url);
    if (!resourceNodes.length) {
      res.code = '4.04';
      res.end();
      return;
    }
    // find nodes matching the method
    const matchedNodes = resourceNodes.filter(n => n.method === req.method);
    if (!matchedNodes.length) {
      res.code = '4.05';
      res.end();
      return;
    }
    // send request and response object to input node
    const node = matchedNodes[0];
    node.receive({ req, res });
  };

  RED.nodes.registerType('coap-server', CoapServerNode);
};

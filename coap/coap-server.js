const coap = require('coap');

module.exports = function (RED) {
  // A node red node that sets up a local coap server
  function CoapServerNode(n) {
    RED.nodes.createNode(this, n);
    this.port = n.port;

    // collection of 'coap in' nodes that represent coap resources
    this.resources = [];
    this.inputNodes = [];

    // setup node-coap server and start
    // TODO: make server options configurable
    this.server = coap.createServer({
      piggybackReplyMs: 1000,
    });
    this.server.on('request', (req, res) => {
      res.on('error', err => {
        this.log('server error');
        this.log(err);
      });
      this.handleRequest(req, res);
    });
    this.server.listen(this.port, () => {
      this.log('CoAP Server listening on ' + this.port);
    });

    this.on('close', () => {
      this.inputNodes = [];
      this.server.close();
    });
  }

  CoapServerNode.prototype.registerNode = function (url, method, node) {
    const duplicates = this.inputNodes.filter(n => n.url === url && n.method === method);
    if (duplicates.length > 0) return false;
    this.resources.push({ url, method, node });
    return true;
  };

  CoapServerNode.prototype.unregisterNode = function (node) {
    const filtered = this.resources.filter(n => n.node !== node);
    if (filtered.length === this.resources.length) return false;
    this.inputNodes = filtered;
    return true;
  };

  CoapServerNode.prototype.handleRequest = function (req, res) {
    // TODO: If the resource is .well-known return the resource directory to the client
    // find any nodes matching the url
    const urlMatches = this.resources.filter(n => n.url === req.url);
    if (!urlMatches.length) {
      res.code = '4.04';
      res.end();
      return;
    }
    // find nodes matching the method
    const methodMatches = urlMatches.filter(n => n.method === req.method);
    if (!methodMatches.length) {
      res.code = '4.05';
      res.end();
      return;
    }
    // send request and response object to input node
    methodMatches[0].node.receive({ req, res });
  };

  RED.nodes.registerType('coap-server', CoapServerNode);
};

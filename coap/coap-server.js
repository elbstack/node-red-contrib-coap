const coap = require('coap');

module.exports = function (RED) {
  // A node red node that sets up a local coap server
  function CoapServerNode(n) {
    // Create a RED node
    RED.nodes.createNode(this, n);
    const node = this;

    // Store local copies of the node configuration (as defined in the .html)
    node.options = {};
    node.options.name = n.name;
    node.options.port = n.port;

    // collection of 'coap in' nodes that represent coap resources
    node.inputNodes = [];

    // Setup node-coap server and start
    node.server = coap.createServer();
    node.server.on('request', (req, res) => {
      node.handleRequest(req, res);
      res.on('error', err => {
        node.log('server error');
        node.log(err);
      });
    });
    node.server.listen(node.options.port, () => {
      // console.log('server started');
      node.log('CoAP Server Started');
    });

    node.on('close', () => {
      node.inputNodes = [];
      node.server.close();
    });
  }

  CoapServerNode.prototype.registerInputNode = function (node) {
    const duplicates = this.inputNodes.filter(n =>
      n.options.url === node.options.url && n.options.method === node.options.method);
    if (duplicates.length > 0) return false;
    this.inputNodes.push(node);
    return true;
  };

  CoapServerNode.prototype.handleRequest = function (req, res) {
    // TODO: If the resource is .well-known return the resource directory to the client
    // Check if there are any matching resource.
    let matchResource = false;
    let matchMethod = false;
    for (let i = 0; i < this.inputNodes.length; i++) {
      if (this.inputNodes[i].options.url === req.url) {
        matchResource = true;
        if (this.inputNodes[i].options.method === req.method) {
          matchMethod = true;
          const inNode = this.inputNodes[i];
          inNode.send({ req, res });
        }
      }
    }
    if (!matchResource) {
      res.code = '4.04';
      res.end();
    }

    if (!matchMethod) {
      res.code = '4.05';
      res.end();
    }
  };

  RED.nodes.registerType('coap-server', CoapServerNode);
};

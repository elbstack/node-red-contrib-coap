module.exports = function (RED) {
  function CoapInNode(n) {
    RED.nodes.createNode(this, n);

    // copy 'coap in' node configuration locally
    this.server = n.server;
    this.method = n.method;
    this.url = n.url.charAt(0) === '/' ? n.url : '/' + n.url;

    const serverNode = RED.nodes.getNode(this.server);

    if (!serverNode) {
      this.status({ fill: 'red', shape: 'dot', text: 'missing server configuration' });
      return;
    }
    if (!serverNode.registerNode(this.url, this.method, this)) {
      this.status({ fill: 'red', shape: 'dot', text: 'resource already existing' });
      return;
    }
    // clear any error states on the node
    this.status({});

    this.on('close', () => {
      serverNode.unregisterNode(this);
    });

    // handle requests incoming from the server node
    this.on('input', msg => {
      this.send({
        topic: msg.req.url,
        payload: msg.req.payload,
        req: msg.req,
        res: msg.res,
      });
    });
  }

  RED.nodes.registerType('coap in', CoapInNode);
};

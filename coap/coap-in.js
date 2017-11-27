module.exports = function (RED) {
  function CoapInNode(n) {
    RED.nodes.createNode(this, n);

    // copy 'coap in' node configuration locally
    this.options = {};
    this.options.method = n.method;
    this.options.name = n.name;
    this.options.server = n.server;
    this.options.url = n.url.charAt(0) === '/' ? n.url : '/' + n.url;

    this.serverConfig = RED.nodes.getNode(this.options.server);

    if (this.serverConfig) {
      this.serverConfig.registerInputNode(this);
    } else {
      this.error('Missing server configuration');
    }
  }

  RED.nodes.registerType('coap in', CoapInNode);
};

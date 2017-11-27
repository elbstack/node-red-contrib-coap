module.exports = function (RED) {
  function CoapOutNode(n) {
    RED.nodes.createNode(this, n);

    // copy 'coap out' node configuration locally
    this.options = {};
    this.options.name = n.name;
    this.options.statusCode = n.statusCode;
    this.options.message = n.message;

    this.on('input', msg => {
      if (this.options.statusCode) {
        msg.res.statusCode = this.options.statusCode;
      } else if (msg.statusCode) {
        msg.res.statusCode = msg.statusCode;
      }
      const content = this.options.message ? this.options.message : msg.payload;
      msg.res.end(content);
    });
  }

  RED.nodes.registerType('coap out', CoapOutNode);
};

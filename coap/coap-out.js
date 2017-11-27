module.exports = function (RED) {
  function CoapOutNode(n) {
    RED.nodes.createNode(this, n);

    // copy 'coap out' node configuration locally
    this.options = {};
    this.options.name = n.name;
    this.options.statusCode = n.statusCode;

    this.on('input', msg => {
      if (this.options.statusCode) {
        msg.res.statusCode = this.options.statusCode;
      } else if (msg.statusCode) {
        msg.res.statusCode = msg.statusCode;
      }
      msg.res.end(msg.payload);
    });
  }

  RED.nodes.registerType('coap out', CoapOutNode);
};

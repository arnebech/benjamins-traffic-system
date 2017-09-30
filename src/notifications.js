const request = require('request');
const conf = require('./conf');

module.exports = {
  send(event) {
    if (!conf.get('ifttt:enabled')) {
      console.log(`ifttt not enabled. Event: ${event}`);
      return;
    }

    request.post({
      url: `https://maker.ifttt.com/trigger/${event}/with/key/${conf.get('ifttt:key')}`,
      json: {},
    }, (err, response, body) => {
      console.log('ifttt response:');
      console.log(body);
    });
  },
};

const path = require('path');

const nconf = require('nconf');

const confDir = path.join(__dirname, '..', 'config');

nconf
  .argv()
  .env()
  .file('machine', { file: path.join(confDir, 'config.machine.ini'), format: nconf.formats.ini })
  .file('default', { file: path.join(confDir, 'config.defaults.ini'), format: nconf.formats.ini });

module.exports = nconf;

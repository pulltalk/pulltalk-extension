// next.config.js
require('ts-node/register'); // allow Node to run TS
const config = require('./next.config.ts').default; // import your TS config
module.exports = config;

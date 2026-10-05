// Optional QA preload: make any unexpected external socket fail and record it.
const fs = require('node:fs');
const net = require('node:net');
const original = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args) {
  const first = Array.isArray(args[0]) ? args[0][0] : args[0];
  const host = typeof first === 'object' ? first?.host : typeof args[1] === 'string' ? args[1] : undefined;
  if (host && !['localhost', '127.0.0.1', '::1'].includes(host)) {
    if (process.env.PASSMATE_NETWORK_LOG) fs.appendFileSync(process.env.PASSMATE_NETWORK_LOG, `${host}\n`);
    throw new Error('External network forbidden during build/check/type verification');
  }
  return original.apply(this, args);
};

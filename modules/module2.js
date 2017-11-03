'use strict';

const module1 = require('./module1');

module.exports = {
  func() {
    return 'Here is the stuff from module 2';
  },
  func2() {
    return `Here we are in module 2 calling module1's func: "${module1.func()}"`;
  }
};

'use strict';

const module3 = require('./module3');

module.exports = {
  func() {
    return 'Here is the stuff from module 1';
  },
  func2() {
    return `In module1, calling 3: ${module3.func()}`;
  }
};

var rel = require('./rel')
  , nested = require('./nested/nest')
  , aboveNested = require('./nested/aboveNested');

window.module('require relatives');
asyncTest('relative sibling requires', function () {
  equals(rel(), 'Hello World!');
  start();
});
asyncTest('relative nested requires', function () {
  equals(nested(), "I'm a descendant");
  start();
});
asyncTest('relative above nested requires', function () {
  equals(aboveNested(), "I'm an ancestor of the descendant");
  start();
});

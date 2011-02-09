var rel = require('./rel')
  , nested = require('./nested/nest')
  , aboveNested = require('./nested/aboveNested')
  , elevator = require('./level1');

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
asyncTest('elevator requires', function () {
  equals(elevator(), "level 1 => level 3 => level 2");
  start();
});

window.module('require npm');
asyncTest('simple npm modules', function () {
  var _ = require('underscore');
  equals(10, _.reduce([1, 2, 3, 4], function (sum, num) {
    sum += num;
    return sum;
  }));
  start();
});
asyncTest('npm submodules', function () {
  var Set = require('data-structures-js/set')
    , s = new Set(['look', 'ma', 'no', 'hands']);
  s.add('look');
  ok(s.contains('ma'));
  start();
});
asyncTest('npm modules that use relative modules', function () {
  // The following file requires ./entities;
  // See https://github.com/chriso/node-validator/blob/master/lib/xss.js
  var clean = require('validator/xss').clean;
  equals('function', typeof clean);
  start();
});

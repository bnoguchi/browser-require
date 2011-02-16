var fs = require('fs')
  , path = require('path')
  , Mode = require('./index');

function CompileMode () {
  Mode.call(this);
}

CompileMode.prototype.__proto__ = Mode.prototype;
CompileMode.prototype.loadSrc = function (url, location, fn) {
};


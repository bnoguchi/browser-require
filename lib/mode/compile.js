var fs = require('fs')
  , path = require('path')
  , Mode = require('./index');

function CompileMode (baseDir) {
  Mode.call(this, baseDir);
}

CompileMode.prototype.__proto__ = Mode.prototype;
CompileMode.prototype.loadSrc = function (url, location, isIndex, fn) {
  var src = fs.readFileSync(location, 'utf8')
    , deps = this.depsFor(src);
};

var fs = require('fs')
  , path = require('path')
  , Mode = require('./index')
  , ModulePromise = require('../shared/module_promise')
  , libdir = path.join(path.dirname(__filename), '..');

// We'll want to store the all modules, including dependencies
// in an object that gets sent back to the browser
function CompileMode (opts) {
  Mode.call(this, opts);
}

CompileMode.prototype.__proto__ = Mode.prototype;

CompileMode.prototype.loadSrc = function (url, location, isIndex, fn) {
  var src = fs.readFileSync(location, 'utf8')
    , deps = this.depsFor(src)

    , tmp = fs.readFileSync(libdir + '/templates/tmp.js');

  src = tmp.replace(/\$module/g, url).replace('$src', src);

  var target = ModulePromise.from(url);
  target.src = src;
  
  if (isIndex) target.isIndex(isIndex);

  var i = deps.length
    , dep;
  if (!i) target.loaded();
  else while (i--) {
    dep = ModulePromise.from(deps[i], mod);
    if (!dep.compiled) {
      target.dependsOn(dep);
      ModulePromise.modules[dep.name] = dep;
      dep.load(this, function (err, src) {
      });
    }
  }
};

// Configure ModulePromise for compile mode
ModulePromise.prototype.load = function (mode, fn) {
  var url = this.url();
  mode.locateAsset(url, function (err, location, isIndex) {
    if (err) return fn(err);
    if (!location) return fn(null, null);
    mode.loadSrc(url, location, isIndex, function (err, src) {
      if (err) return fn(err);
      mode.cache[url] = src;
      fn(null, src);
    });
  });
};

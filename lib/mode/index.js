var path = require('path')
  , NpmModule = require('../npm_module');

function Mode () {
  this.cache = {};
}

Mode.prototype = {
  loadAsset: function (url, fn) {
    var self = this
      , cache = this.cache;
    if (cache[url]) return fn(null, cache[url]);
    if ('.js' !== path.extname(url)) return fn(null, null);
    this.locateAsset(url, function (err, location, isIndex) {
      if (err) return fn(err);
      if (!location) return fn(null, null);
      self.loadSrc(url, location, isIndex, function (err, src) {
        if (err) return fn(err);
        cache[url] = src;
        fn(null, src);
      });
    });
  },
  locateAsset: function (url, fn) {
    if (NpmModule.npmFlag.test(url)) {
      var npmModule = new NpmModule(url)
        , filepath;
      npmModule.isInstalled(function (err, isInstalled) { // Handle npm modules
        if (err) return fn(err);
        if (isInstalled) {
          npmModule.locate(fn);
        } else {
          err = new Error("Could not find " + npmModule.pkgName +
            ". Make sure it's installed via npm.");
          fn(err);
        }
      });
    } else { // Handle local, relative modules
      filepath = path.join(baseDir, url);
      if (path.existsSync(filepath)) {
        fn(null, filepath);
      } else {
        // Probably a static file
        fn(null, null);
      }
    }
  },
  depsFor: function (src) {
    var re = /require\(['"]([^'"]+)['"]\)/g
      , match
      , deps = [];
    while (match = re.exec(src)) {
      deps.push(match[1]);
    }
    return deps;
  }
};

module.exports = Mode;

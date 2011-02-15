var fs = require('fs')
  , path = require('path')
  , NpmModule = require('./npm_module');

module.exports = function (opts) {
  var baseDir = opts.base
    , mode;
  if (opts.compile) {
    mode = new CompileMode();
  } else {
    mode = new DynamicMode();
  }

  var cache = {};

  function Mode () {}

  Mode.prototype = {
    loadAsset: function (url, fn) {
      var self = this;
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

  function DynamicMode () {}

  DynamicMode.prototype.__proto__ = Mode.prototype;
  DynamicMode.prototype.loadSrc = function (url, location, isIndex, fn) {
    var src = fs.readFileSync(location, 'utf8');
    if (url === '/browser_require.js') return fn(null, src);
    src = this.fillinTemplate(url, src, this.depsFor(src), isIndex);
    fn(null, src);
  };
  DynamicMode.prototype.templates = {
      response: fs.readFileSync(__dirname + '/templates/response.js', 'utf8')
    , src: fs.readFileSync(__dirname + '/templates/src.js', 'utf8')
  };
  DynamicMode.prototype.fillinTemplate = function (module, src, deps, isIndex) {
    var templates = this.templates
      , dir = isIndex
            ? module.replace(/\.js$/, '').split('/')
            : module.split('/').slice(0, -1)
      , src = templates.src
                .replace('$src', src)
                .replace(/\$dir/g, JSON.stringify(dir));
    return templates.response
      .replace('$module', JSON.stringify(module))
      .replace('$src', JSON.stringify(src))
      .replace('$deps', JSON.stringify(deps))
      .replace('$isIndex', isIndex);
  };

  DynamicMode.prototype.loadAsset = function (url, fn) {
    url = this.extractUrl(url);
    Mode.prototype.loadAsset.call(this, url, fn);
  };

  DynamicMode.prototype.locateAsset = function (url, fn) {
    if (url === '/browser_require.js')
      return fn(null, path.dirname(__filename) + '/client/browser_require.js');
    Mode.prototype.locateAsset.call(this, url, fn);
  };

  /**
   * The incoming url does not always verbatim point to the src file.
   * This is not the case for modules that live above the base dir
   */
  DynamicMode.prototype.extractUrl = function (url) {
    // The following continuous block handles incoming requires
    // that exist above the base dir
    var uq = url.split('?')
      , chain = uq[0].split('/')
      , q = uq[1]
      , match
      , nAboveBase;
    // prefix carries ..,..,.. information - i.e., how many levels above
    if (q) {
      match = q.match(/n=([^&]+)/);
      if (match) nAboveBase = parseInt(match[1], 10);
    }
    if (nAboveBase) {
      url = chain.join('/');
      while (nAboveBase--) url = '/..' + url;
    }
    return url;
  };

  function CompileMode () {}

  CompileMode.prototype.__proto__ = Mode.prototype;
  CompileMode.prototype.loadSrc = function (url, location, fn) {
  };

  return function (req, res, next) {
    mode.loadAsset(req.url, function (err, src) {
      if (err) {
        console.error(err);
        res.writeHead(404);
        res.end();
      } else if (src) {
        res.writeHead(200, {'Content-Type': 'text/javascript'});
        res.end(src);
      } else {
        next();
      }
    });
  };
};

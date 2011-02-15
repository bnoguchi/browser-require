var fs = require('fs')
  , path = require('path')
  , npm = require('npm');

module.exports = function (opts) {
  var baseDir = opts.base
    , compile = opts.compile

    , cache = {} // {moduleName: { mtime: ..., compiled: ...}}
    , templates = {
          response: fs.readFileSync(__dirname + '/templates/response.js', 'utf8')
        , src: fs.readFileSync(__dirname + '/templates/src.js', 'utf8')
      };

  /**
   * Loads the module's parameters into the template.
   * In dynamic mode, the template is sent to the browser.
   * In compile mode, the template is used as a fragment in the aggregate compiled output.
   *
   * @param {String} module is the name of the module (e.g., 'somemodule.js')
   * @param {String} src is the src of the module
   * @param {Array} deps is the array of the module's dependencies, as Strings
   * @param {Boolean} isIndex is true if module's src existed at an index.js
   * @return {String} the template that is filled in with the module's information
   */
  function fillinTemplate (module, src, deps, isIndex) {
    var dir = isIndex
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
  }

  /**
   * Returns the names of the dependencies found in the source text.
   *
   * @param {String} src
   * @return {Array} dependencies 
   */
  function depsFor (src) {
    var re = /require\(['"]([^'"]+)['"]\)/g
      , match
      , deps = [];
    while (match = re.exec(src)) {
      deps.push(match[1]);
    }
    return deps;
  }

  function NpmModule (url) {
    var modulePath = url.replace(NpmModule.npmFlag, '').replace(/\.js$/, '')
      , moduleChain = modulePath.split('/')
      , pkgName = this.pkgName = moduleChain[0]
      , relChain = this.relChain = moduleChain.slice(1);
    this.isSubmodule = !!relChain.length;
    var nv = pkgName.split('@')
      , n = this.name = nv[0]
      , v = this.ver = nv[1] || 'active';
    this.dir = path.join(npm.dir, n, v, 'package');
  }
  NpmModule.npmFlag = /^\/NPM\//;

  NpmModule.prototype = {
    __pkgJson: function (fn) {
      if (this._pkg) return fn(null, this._pkg);
      if (this._pkgerr) return fn(this._pkgerr);
      var self = this;
      fs.readFile(this.dir + '/package.json', 'utf8', function (err, body) {
        if (err) {
          self._pkgerr = err;
          console.error("package.json missing for " + self.pkgName);
          return fn(err);
        }
        var pkg = self._pkg = JSON.parse(body);
        fn(null, pkg);
      });
    },
    __mainSrc: function (fn) {
      if (this._mainSrc) return fn(null, this._mainSrc);
      if (this._mainSrcErr) return fn(this._mainSrcErr);
      var self = this;
      this.pkgJson( function (err, pkg) {
        if (err) return fn(self._mainSrcErr = err);
        if (pkg.main) {
          fs.stat(self.dir + '/' + pkg.main, function (err, stat) {
            if (err) {
              console.error(err);
              fn(self._mainSrcErr = err);
            } else if (stat.isDirectory()) {
              self._mainSrc = fs.readFileSync(self.dir + '/' + pkg.main + '/index.js', 'utf8');
              fn(null, self._mainSrc);
            } else {
              self._mainSrc = fs.readFileSync(self.dir + '/' + pkg.main, 'utf8');
              fn(null, self._mainSrc);
            }
          });
        } else {
          fn(self.mainSrcErr = "Missing main in package.json for " + self.pkgName);
        }
      });
    },
    __relSrc: function (fn) {
      if (this._relSrc) return fn(null, this._relSrc);
      if (this._relSrcErr) return fn(this._relSrcErr);
      var self = this;
      this.pkgJson( function (err, pkg) {
        if (err) return fn(self._relSrcErr = err);
        var directories = pkg.directory || pkg.directories
          , lib = directories && directories.lib
          , chain = [self.dir], direct, index;
        if (lib) chain.push(lib);
        direct = path.join.apply(this, chain.concat([self.relChain.join('/') + '.js']) );
        index  = path.join.apply(this, chain.concat([self.relChain.join('/'), 'index.js']) );
        if (path.existsSync(direct)) {
          fn(null, fs.readFileSync(direct, 'utf8'), false);
        } else if (path.existsSync(index)) {
          fn(null, fs.readFileSync(index, 'utf8'), true);
        } else {
          if (lib) {
            throw new Error("Unimplemented - could not find package " + self.relChain.join('/'));
          } else {
            self._relSrcErr = 'Missing ' + self.relChain.join('/') + ' in ' + self.pkgName + ' package';
            fn(self._relSrcErr);
          }
        }
      });
    },
    __src: function (fn) {
      if (this._src) return fn(null, this._src);
      if (this._srcerr) return fn(this._srcerr);
      var self = this;
      if (this.isSubmodule) { // Handle e.g., require("npm-module/sub-module")
        this.relSrc( function (err, relSrc, isIndex) {
          if (err) return fn(self._srcerr = err);
          fn(null, self._src = relSrc, isIndex);
        });
      } else { // Handle e.g., require("npm-module")
        this.mainSrc( function (err, mainSrc) {
          if (err) return fn(self._srcerr = err);
          fn(null, self._src = mainSrc);
        });
      }
    },
    __isInstalled: function (fn) {
      var self = this;
      fs.stat(this.dir, function (err, stat) {
        if (err || !stat.isDirectory()) {
          console.error(self.name + " is not installed via npm.");
          fn(err, false);
        } else {
          fn(null, true);
        }
      });
    }
  };

  // Wrap npm in a promise, for manageable async middleware
  NpmModule.isNpmLoaded = false;
  NpmModule.callbacks = []; // Callbacks for loaded event
  var proto = NpmModule.prototype;
  for (var k in proto) {
    proto[k.slice(2)] = (function (k) {
      return function () {
        if (NpmModule.isNpmLoaded) return proto[k].apply(this, arguments);
        NpmModule.callbacks.push([proto[k], this, arguments]);
      };
    })(k);
  }
  npm.load( function () {
    NpmModule.isNpmLoaded = true;
    var callbacks = NpmModule.callbacks;
    for (var i = 0, l = callbacks.length; i < l; i++) {
      callbacks[i][0].apply(callbacks[i][1], callbacks[i][2]);
    }
  });

  /**
   * The incoming url does not always verbatim point to the src file.
   * This is not the case for 
   */
  function extractUrl (url) {
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
  }

  return function (req, res, next) {
    var src
      , url = extractUrl(req.url)
      , body
      , filepath;

    if (src = cache[url]) {
      res.writeHead(200, {'Content-Type': 'text/javascript'});
      res.end(src);
    } else if ('.js' === path.extname(url)) {
      if (url === '/browser_require.js') {
        src = 
          cache[url] = fs.readFileSync(
            path.dirname(__filename) + 
            '/client/browser_require.js', 'utf8');

        res.writeHead(200, {'Content-Type': 'text/javascript'});
        res.end(src);
      } else if (NpmModule.npmFlag.test(url)) { // Handle npm modules
        var npmModule = new NpmModule(url);
        npmModule.isInstalled(function (err, isInstalled) {
          if (isInstalled) {
            npmModule.src(function (err, body, isIndex) {
              var src = 
                cache[url] = fillinTemplate(url, body, depsFor(body), isIndex);
              res.writeHead(200, {'Content-Type': 'text/javascript'});
              res.end(src);
            });
          } else {
            console.error("Could not find " + npmModule.pkgName + 
                          ". Make sure it's installed via npm.");
            res.writeHead(404);
            res.end();
          }
        });
      } else { // Handle local, relative modules
        filepath = path.join(baseDir, url);
        if (path.existsSync(filepath)) {
          body = fs.readFileSync(filepath, 'utf8');
          src = 
            cache[url] = fillinTemplate(url, body, depsFor(body));
          res.writeHead(200, {'Content-Type': 'text/javascript'});
          res.end(src);
        } else {
          console.error("Could not find " + filepath);
          next();
        }
      }
    } else {
      next();
    }
  };
};

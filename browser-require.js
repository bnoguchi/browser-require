var fs = require('fs')
  , path = require('path')
  , npm = require('npm');

module.exports = function (opts) {
  var baseDir = opts.base
    , cache = {} // {moduleName: { mtime: ..., compiled: ...}}
    , templates = {
          response: fs.readFileSync(__dirname + '/templates/response.js', 'utf8')
        , src: fs.readFileSync(__dirname + '/templates/src.js', 'utf8')
      };

  function fillinTemplate (module, src, deps) {
    var src = templates.src
                .replace('$src', src)
                .replace(/\$dir/g, JSON.stringify(module.split('/').slice(0, -1)));
    return templates.response
      .replace('$module', JSON.stringify(module))
      .replace('$src', JSON.stringify(src))
      .replace('$deps', JSON.stringify(deps));
  }

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
    pkgJson: function (fn) {
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
    mainSrc: function (fn) {
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
    relSrc: function (fn) {
      if (this._relSrc) return fn(null, this._relSrc);
      if (this._relSrcErr) return fn(this._relSrcErr);
      var self = this;
      this.pkgJson( function (err, pkg) {
        if (err) return fn(self._relSrcErr = err);
        var directories = pkg.directory || pkg.directories
          , lib = directories.lib
          , dest;
        if (lib) {
          dest = path.join(self.dir, lib, self.relChain.join('/') + '.js');
          if (path.existsSync(dest)) {
            fn(null, fs.readFileSync(dest, 'utf8'));
          } else {
            throw new Error("Unimplemented");
          }
        } else {
          self._relSrcErr = 'Missing ' + self.relChain.join('/') + ' in ' + self.pkgName + ' package';
          fn(self._relSrcErr);
        }
      });
    },
    src: function (fn) {
      if (this._src) return fn(null, this._src);
      if (this._srcerr) return fn(this._srcerr);
      var self = this;
      if (this.isSubmodule) { // Handle e.g., require("npm-module/sub-module")
        this.relSrc( function (err, relSrc) {
          if (err) return fn(self._srcerr = err);
          fn(null, self._src = relSrc);
        });
      } else { // Handle e.g., require("npm-module")
        this.mainSrc( function (err, mainSrc) {
          if (err) return fn(self._srcerr = err);
          fn(null, self._src = mainSrc);
        });
      }
    }
  };

  // Wrap npm as promise $npm, for manageable async middleware
  var $npm = (function () {
    var isLoaded = false
      , callbacks = [];

    npm.load( function () {
      isLoaded = true;
      for (var i = 0, l = callbacks.length; i < l; i++) {
        callbacks[i][0].apply(this, callbacks[i][1]);
      }
    });

    var isNpmModule = function (module, fn) {
      if (isLoaded) return _isNpmModule(module, fn);
      callbacks.push([_isNpmModule, arguments]);
    };

    var _isNpmModule = function (module, fn) {
      fs.stat(module.dir, function (err, stat) {
        if (err || !stat.isDirectory()) {
          console.error(module.name + " is not installed via npm.");
          fn(err, false);
        } else {
          fn(null, true);
        }
      });
    };

    var loadNpmModule = function (module, fn) {
      if (isLoaded) return _loadNpmModule(module, fn);
      callbacks.push([_loadNpmModule, arguments]);
    };

    var _loadNpmModule = function (module, fn) {
      module.src(fn);
    };

    return {
        isNpmModule: isNpmModule
      , loadNpmModule: loadNpmModule
    };

  })();

  return function (req, res, next) {
    var src
      , url = req.url
      , body
      , filepath;
    if (src = cache[url]) {
      res.writeHead(200, {'Content-Type': 'text/javascript'});
      res.end(src);
    } else if ('.js' === path.extname(url)) {
      if (url === '/browser_require.js') {
        src = 
          cache[url] = fs.readFileSync(path.dirname(__filename) + '/client/browser_require.js', 'utf8');

        res.writeHead(200, {'Content-Type': 'text/javascript'});
        res.end(src);
      } else if (NpmModule.npmFlag.test(url)) { // Handle npm modules
        var npmModule = new NpmModule(url);
        $npm.isNpmModule(npmModule, function (err, isNpm) {
          if (isNpm) {
            $npm.loadNpmModule(npmModule, function (err, body) {
              var src = 
                cache[url] = fillinTemplate(url, body, depsFor(body));
              res.writeHead(200, {'Content-Type': 'text/javascript'});
              res.end(src);
            });
          } else {
            console.error("Could not find " + pkgName + ". Make sure it's installed via npm.");
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
          console.log("Could not find " + filepath);
          next();
        }
      }
    } else {
      next();
    }
  };
};

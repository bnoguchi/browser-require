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

    var isNpmModule = function (name, fn) {
      if (isLoaded) return _isNpmModule(name, fn);
      callbacks.push([_isNpmModule, arguments]);
    };

    var _isNpmModule = function (name, fn) {
      var nv = name.split('@')
        , n = nv[0]
        , v = nv[1] || 'active'
        , dir = path.join(npm.dir, n, v, 'package');
      fs.stat(dir, function (err, stat) {
        if (err || !stat.isDirectory()) {
          console.error(name + " is not installed via npm.");
          fn(err, false);
        } else {
          fn(null, true);
        }
      });
    };

    var loadNpmModule = function (name, relChain, fn) {
      if (isLoaded) return _loadNpmModule(name, relChain, fn);
      callbacks.push([_loadNpmModule, arguments]);
    };

    var _loadNpmModule = function (name, relChain, fn) {
      var nv = name.split('@')
        , n = nv[0]
        , v = nv[1] || 'active'
        , dir = path.join(npm.dir, n, v, 'package');
      fs.readFile(dir + '/package.json', 'utf8', function (err, body) {
        if (err) { console.error("package.json missing for " + name); return fn(err); }
        var pkg = JSON.parse(body);
        if (!relChain.length) { // Handle require("npm-module")
          if (pkg.main) {
            fs.stat(dir + '/' + pkg.main, function (err, stat) {
              if (err) {
                console.error(err);
                fn(err);
              } else if (stat.isDirectory()) {
                fn(null, fs.readFileSync(dir + '/' + pkg.main + '/index.js', 'utf8'));
              } else {
                fn(null, fs.readFileSync(dir + '/' + pkg.main, 'utf8'));
              }
            });
          }
          else fn("Missing main in package.json for " + name);
        } else { // Handle e.g., require("npm-module/sub-module")
          var directories = pkg.directory || pkg.directories
            , lib = directories.lib
            , dest;
          if (lib) {
            dest = path.join(dir, lib, relChain.join('/') + '.js');
            if (path.existsSync(dest)) {
              fn(null, fs.readFileSync(dest));
            } else {
              throw new Error("Unimplemented");
            }
          } else fn("Missing " + relChain.join('/') + " in " + name + " package");
        }
      });
    };

    return {
        isNpmModule: isNpmModule
      , loadNpmModule: loadNpmModule
    };

  })();

  return function (req, res, next) {
    var src = cache[req.url]
      , body
      , filepath
      , npmFlag = /^\/NPM\//;
    if (src) {
      res.writeHead(200, {'Content-Type': 'text/javascript'});
      res.end(src);
    } else if ('.js' === path.extname(req.url)) {
      if (req.url === '/browser_require.js') {
        src = 
          cache[req.url] = fs.readFileSync(path.dirname(__filename) + '/client/browser_require.js', 'utf8');

        res.writeHead(200, {'Content-Type': 'text/javascript'});
        res.end(src);
      } else if (npmFlag.test(req.url)) {
        var modulePath = req.url.replace(npmFlag, '').replace(/\.js$/, '')
          , moduleChain = modulePath.split('/')
          , pkgName = moduleChain[0]
          , relChain = moduleChain.slice(1);
        $npm.isNpmModule(pkgName, function (err, isNpm) {
          if (isNpm) {
            $npm.loadNpmModule(pkgName, relChain, function (err, body) {
              var src = 
                cache[req.url] = fillinTemplate(req.url, body, depsFor(body));
              res.writeHead(200, {'Content-Type': 'text/javascript'});
              res.end(src);
            });
          } else {
            console.error("Could not find " + pkgName + ". Make sure it's installed via npm.");
            res.writeHead(404);
            res.end();
          }
        });
      } else {
        filepath = path.join(baseDir, req.url);
        if (path.existsSync(filepath)) {
          body = fs.readFileSync(filepath, 'utf8');
          src = 
            cache[req.url] = fillinTemplate(req.url, body, depsFor(body));
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

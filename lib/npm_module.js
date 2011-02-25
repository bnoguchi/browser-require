var fs = require('fs')
  , path = require('path')
  , npm = require('npm');

function NpmModule (url) {
  var modulePath = url.replace(/\.js$/, '')
    , moduleChain = modulePath.split('/')
    , pkgName = this.pkgName = moduleChain[0]
    , relChain = this.relChain = moduleChain.slice(1);
  this.isSubmodule = !!relChain.length;
  var nv = pkgName.split('@')
    , n = this.name = nv[0]
    , v = this.ver = nv[1] || 'active';
}

// Different situations:
// requires from `main`
// requires like 'module-name/sub'
// relative requires (./etc) from a file in `lib` directory
NpmModule.prototype = {
  __locate: function (fn) {
    if (this._location) return fn(null, this._location, this._isIndex);
    if (this._locationErr) return fn(this._locationErr);
    var self = this;
    if (this.isSubmodule) {
      this.relLocate(function (err, location, isIndex) {
        self._locationerr = err;
        self._location = location;
        self._isIndex = isIndex;
        fn(err, location, isIndex);
      });
    } else {
      this.mainLocate(function (err, location) {
        self._locationErr = err;
        self._location = location;
        fn(err, location);
      });
    }
  },
  __relLocate: function (fn) {
    if (this._relLocation) return fn(null, this._relLocation);
    if (this._relLocationErr) return fn(this._relLocationErr);
    var self = this, err;
    this.pkgJson(function (err, pkg) {
      if (err) return fn(self._relLocationErr = err);
      var directories = pkg.directory || pkg.directories
        , lib = directories && directories.lib
        , chain = [self.dir], direct, index;
      if (lib) chain.push(lib);
      direct = path.join.apply(this, chain.concat([self.relChain.join('/') + '.js']) );
      index  = path.join.apply(this, chain.concat([self.relChain.join('/'), 'index.js']) );
      if (path.existsSync(direct)) {
        fn(null, direct, false);
      } else if (path.existsSync(index)) {
        fn(null, index, true);
      } else {
        if (lib) {
          err = self._relLocationErr = 
            new Error('Unimplemented - could not find package ' +
              self.relChain.join('/') + ' relative to ' + 
              path.join.apply(path, chain));
        } else {
          err = self._relLocationErr = 
            new Error('Missing ' + self.relChain.join('/') + 
              ' in ' + self.pkgName + ' package');
        }
        fn(err);
      }
    });
  },
  __mainLocate: function (fn) {
    if (this._mainLocation) return fn(null, this._mainLocation);
    if (this._mainLocateErr) return fn(this._mainLocateErr);
    var self = this;
    this.pkgJson( function (err, pkg) {
      if (err) return fn(self._mainLocateErr = err);
      if (pkg.main) {
        pkg.main = (path.extname(pkg.main) === '.js')
                 ? pkg.main.slice(0, -3)
                 : pkg.main;
        fs.stat(self.dir + '/' + pkg.main, function (err, stat) {
          if (err) {
            path.exists(self.dir + '/' + pkg.main + '.js', function (exists) {
              self._mainLocation = self.dir + '/' + pkg.main + '.js';
              fn(null, self._mainLocation);
            });
          } else if (stat.isDirectory()) {
            self._mainLocation = self.dir + '/' + pkg.main + '/index.js';
            fn(null, self._mainLocation);
          }
        });
      } else {
        fn(self._mainLocateErr = "Missing main in package.json for " + self.pkgName);
      }
    });
  },
  __pkgJson: function (fn) {
    if (this._pkg) return fn(null, this._pkg);
    if (this._pkgerr) return fn(this._pkgerr);
    var self = this;
    fs.readFile(this.dir + '/package.json', 'utf8', function (err, body) {
      if (err) {
        self._pkgerr = err = 
          new Error("package.json missing for " + self.pkgName);
        return fn(err);
      }
      var pkg = self._pkg = JSON.parse(body);
      fn(null, pkg);
    });
  },
  __isInstalled: function (fn) {
    var self = this;
    fs.stat(this.dir, function (err, stat) {
      if (err || !stat.isDirectory()) {
        err = new Error(self.name + " is not installed via npm.");
        fn(err, false);
      } else {
        fn(null, true);
      }
    });
  }
};

Object.defineProperty(NpmModule.prototype, 'dir', {
  get: function () {
    return path.join(npm.dir, this.name, this.ver, 'package');
  }
});

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

module.exports = NpmModule;

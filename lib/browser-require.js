// 1. Read the top file
// 2. Parse out the dependency names
// 3. Resolve the file locations based on name + file depending on it
// 4. For each dependency, read it and go to (2). Rinse and repeat
//    until no more files to read
// 5. Compile the top file and all dependencies into a single  file

var fs = require('fs')
  , path = require('path')
  , cache = {}
  , dependencyPromise = require('dependency-promise')
  , libdir = path.join(path.dirname(__filename))
  , NpmModule = require('./npm_module');

function succeed (res, src) {
  res.writeHead(200, {'Content-Type': 'text/javascript'});
  res.end(src);
}

function fail(res, err) {
  console.error(err);
  res.writeHead(404);
  res.end();
}
var templates = {
    boilerplate: fs.readFileSync(libdir + '/templates/boilerplate.js', 'utf8')
  , injectModule: fs.readFileSync(libdir + '/templates/inject_module.js', 'utf8')
}
function ScriptPromise (name, location, isNpm) {
  this.name = name;
  this.dir = path.dirname(name);
  this.location = location;
  this.isNpm = isNpm;
  this.on('error', this.onError);
}

ScriptPromise.modules = {};

ScriptPromise.from = function (name, parent, fn) {
  var self = this;
  this.lookup( name, parent, function (err, normalized, location, isNpm) {
    if (err) return fn(err);
    fn(null, self.modules[normalized] || new ScriptPromise(normalized, location, isNpm));
  });
};

ScriptPromise.lookup = function (name, parent, fn) {
  var char0 = name.charAt(0);
  if (char0 === '.' || char0 === '/') {
    if (parent && parent.isNpm) {
      this.lookupNpm(path.join(path.dirname(parent.name), name), fn);
    } else {
      this.lookupRel(name, parent, fn);
    }
  } else {
    this.lookupNpm(name, fn);
  }
};

ScriptPromise.lookupRel = function (name, parent, fn) {
  var normDirect, normIndex
    , directLocation
    , parentdir
    , self = this;
  if (!parent) {
    normDirect = name + '.js';
    normIndex = name + '/index.js';
    directLocation = path.join(this.base, normDirect);
  } else {
    parentdir = path.dirname(parent.name);
    normDirect = this.normalizeToParent(name + '.js', parentdir);
    normIndex = this.normalizeToParent(name + '/index.js', parentdir);
    directLocation = path.join(this.base, normDirect);
  }
  path.exists(directLocation, function (doesExist) {
    if (doesExist) return fn(null, normDirect, directLocation);
    var indexLocation = path.join(self.base, normIndex);
    path.exists(indexLocation, function (doesExist) {
      if (doesExist) return fn(null, normIndex, indexLocation);
      fn(new Error("module " + name + " seems to be missing."));
    });
  });
};

ScriptPromise.normalizeToParent = function (name, parentdir) {
  var parts = name.split('/')
    , dirparts = parentdir.split('/')
    , aboveBase = false;
  for (var i = 0, l = parts.length, part; i < l; i++) {
    part = parts[i];
    if (part === '.') continue;
    else if (part === '..') {
      if (dirparts.length === 1) aboveBase = true;
      if (!aboveBase) dirparts.pop();
      else dirparts.push(part);
    } else dirparts.push(part);
  }
  return dirparts.join("/");
};

ScriptPromise.lookupNpm = function (name, fn) {
  var npmModule = new NpmModule(name);
  npmModule.isInstalled(function (err, isInstalled) { // Handle npm modules
    if (err) return fn(err);
    if (isInstalled) {
      npmModule.locate(function (err, location, isIndex) {
        if (err) return fn(err);
        var normalized = name + (isIndex ? '/index.js' : '.js');
        fn(null, normalized, location, true);
      });
    } else {
      err = new Error("Could not find " + npmModule.pkgName +
        ". Make sure it's installed via npm.");
      fn(err);
    }
  });
};

ScriptPromise.prototype = {
  onError: function (err) {
    throw new Error(err);
  },
  load: function () {
    var self = this;
    fs.readFile(this.location, 'utf8', function (err, src) {
      if (err) return self.trigger('error', err);
      self.src = src;
      var depNames = self.depsFor(src);
      if (!depNames.length) {
        return self.trigger('loaded');
      }
      var deps = depNames.forEach( function (name) {
        ScriptPromise.from(name, self, function (err, script) {
          if (err) return self.trigger("error", err);
          script.load();
          self.dependsOn('loaded', [script]);
        });
      });
    });
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

for (var k in dependencyPromise) {
  ScriptPromise.prototype[k] = dependencyPromise[k];
}

function wrapDeps (script) {
  var src = {}
    , deps = script.dependenciesFor('loaded')
    , i = deps.length, dep;
  while (i--) {
    dep = deps[i];
    if (src[dep.name]) continue;
    src[dep.name] = wrapScript(dep);
    var wrapped = wrapDeps(dep);
    for (var k in wrapped) {
      src[k] = wrapped[k];
    }
  }
  return src;
}

function wrapScript (script) {
  return templates.injectModule
    .replace(/\$module/g, JSON.stringify(script.name))
    .replace('$dir', JSON.stringify(script.dir))
    .replace('$src', script.src);
}

function compileAll (script, fn) {
  script.on('loaded', function () {
    var compiled = [templates.boilerplate]
      , deps = wrapDeps(script);
    for (var k in deps) {
      compiled.push(deps[k]);
    }
    compiled.push(wrapScript(script));
    compiled.push("browserRequire('" + script.name.slice(0, -3) + "');");
    fn(null, compiled.join("\n"));
  });
  script.load();
}

module.exports = function exposeRequire (opts) {
  return function (req, res, next) {
    var url = req.url;
    if (cache[url]) return succeed(res, cache[url]);
    if ('.js' !== path.extname(url)) return next();
    url = url.replace(/\.js$/, '');

    ScriptPromise.base = opts.base;

    ScriptPromise.from(url, null, function (err, script) {
      if (err) throw err;
      compileAll(script, function (err, compiled) {
        if (err) return fail(res, err);
        if (!compiled) return next();

        cache[url] = compiled;
        succeed(res, compiled);
      });
    });
  };
};

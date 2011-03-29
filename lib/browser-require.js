// 1. Read the top file
// 2. Parse out the dependency names
// 3. Resolve the file locations based on name + file depending on it
// 4. For each dependency, read it and go to (2). Rinse and repeat
//    until no more files to read
// 5. Compile the top file and all dependencies into a single  file

var fs = require('fs')
  , path = require('path')
  , EventEmitter = require('events').EventEmitter
  , cache = {}
  , dependencyPromise = require('dependency-promise')
  , libdir = path.join(path.dirname(__filename))
  , NpmModule = require('./npm_module');

function succeed (res, src) {
  res.writeHead(200, {'Content-Type': 'text/javascript'});
  res.end(src);
}

function fail(res, err) {
  res.writeHead(404);
  res.end();
}
var templates = {
    boilerplate: fs.readFileSync(libdir + '/templates/boilerplate.js', 'utf8')
  , injectModule: fs.readFileSync(libdir + '/templates/inject_module.js', 'utf8')
}

function ScriptPromise (name, location, npmBase) {
  EventEmitter.call(this);
    this.setMaxListeners(0);
  this.name = name;
  if (npmBase) {
    if (name.indexOf('/') === -1)
      this.nextRelTo = name.slice(0, -3);
    else
      this.nextRelTo = name.split('/').slice(0, -1).join('/');
    this.npmBase = npmBase;
  } else {
    this.nextRelTo = path.dirname(name);
  }
  this.location = location;
  this.addListener('error', this.onError);
}

ScriptPromise.prototype.__proto__ = EventEmitter.prototype;
for (var k in dependencyPromise) {
  ScriptPromise.prototype[k] = dependencyPromise[k];
}


ScriptPromise.modules = {};

ScriptPromise.from = function (name, parent, fn) {
  var self = this;
  if (path.extname(name) === '.js') name = name.slice(0, -3);
  this.lookup( name, parent, function (err, normalized, location, npmBase) {
    var mod = self.modules[normalized] || (self.modules[normalized] = new ScriptPromise(normalized, location, npmBase));
    if (err) return mod.emit('error', err);
    fn(mod);
  });
};

ScriptPromise.lookup = function (name, parent, fn) {
  var char0 = name.charAt(0);
  if (char0 === '.' || char0 === '/') {
    if (parent && parent.npmBase) {
      // In case we have e.g., 'some-npm-module.js' as parent.name
      // Then we don't want to pass along '.'. We want to pass along
      // 'some-npm-module'
      this.lookupRel(name, parent, fn);
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
    , base
    , dir
    , self = this;
  if (name.charAt(0) === '/') name = '.' + name;
  if (!parent) {
    normDirect = name + '.js';
    normIndex = name + '/index.js';
    dir = this.base;
  } else {
    parentdir = parent.nextRelTo;
    normDirect = this.normalizeToParent(name + '.js', parentdir);
    normIndex = this.normalizeToParent(name + '/index.js', parentdir);
    dir = path.dirname(parent.location);
  }
  directLocation = path.join(dir, name + '.js');
  path.exists(directLocation, function (doesExist) {
    if (doesExist) return fn(null, normDirect, directLocation, parent && parent.npmBase);
    var indexLocation = path.join(dir, name + '/index.js');
    path.exists(indexLocation, function (doesExist) {
      if (doesExist) return fn(null, normIndex, indexLocation, parent && parent.npmBase);
      fn(new Error("module " + name + " seems to be missing" + 
                   (parent ? " relative to parent " + parent.name : '')));
    });
  });
};

ScriptPromise.normalizeToParent = function (name, parentdir) {
  if (parentdir === '/') parentdir = '.';
  else if (parentdir.charAt(0) === '/') parentdir = '.' + parentdir;
  var parts = name.split('/')
    , dirparts = parentdir.split('/')
    , aboveBase = false;
  for (var i = 0, l = parts.length, part; i < l; i++) {
    part = parts[i];
    if (part === '.') continue;
    else if (part === '..') {
      if (dirparts.length === 1 && dirparts[0] === '.') {
        dirparts.pop();
        aboveBase = true;
      }
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
        fn(null, normalized, location, npmModule.dir);
      });
    } else {
      err = new Error("Could not find " + npmModule.pkgName +
        ". Make sure it's installed via npm.");
      fn(err);
    }
  });
};

ScriptPromise.prototype.onError = function (err) {
  throw err;
};

ScriptPromise.prototype.load = function () {
  var self = this;
  fs.readFile(this.location, 'utf8', function (err, src) {
    if (err) return self.emit('error', err);
    self.src = src;
    var depNames = self.depsFor(src);
    if (!depNames.length)
      return self.trigger('loaded', true);
    var deps = [];
    depNames.forEach( function (name) {
      ScriptPromise.from(name, self, function (script) {
        if (!script.isTriggered('loaded')) script.load();
        deps.push(script);
        // TODO
        script.addListener('reloaded', function (src) {
        });
        if (deps.length === depNames.length) {
          self.dependsOn('loaded', deps);
        }
      });
    });
  });

  // For --watch
//  fs.watchFile(this.location, function (curr, prev) {
//    if (curr.mtime.getTime() > prev.mtime.getTime()) {
//      self.reload();
//    } else {
//      throw new Error("Times are weird");
//    }
//  });
}
ScriptPromise.prototype.depsFor = function (src) {
  var re = /^[^(?:\*|\/)]*\s*require\(['"]([^'"]+)['"]\)/gm
    , match
    , deps = [];
  while (match = re.exec(src)) {
    deps.push(match[1]);
  }
  return deps;
};
ScriptPromise.prototype.reload = function (src) {
  var self = this;
  fs.readFile(this.location, 'utf8', function (err, src) {
    if (err) return self.emit('error', err);
    self.src = src;
    // Check for dependency additions or removals
    var depNames = self.depsFor(src);
    // TODO

    // Notify anyone who depends on me
    self.emit('reloaded', src);
  });
};

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
    .replace(/\$dir/g, JSON.stringify(script.nextRelTo))
    .replace('$src', script.src);
}

exports = module.exports = function exposeRequire (opts) {
  ScriptPromise.base = opts.base;

  return function (req, res, next) {
    var url = req.url;
    if (cache[url]) return succeed(res, cache[url]);
    if ('.js' !== path.extname(url)) return next();
    url = url.replace(/\.js$/, '');

    ScriptPromise.from(url, null, function (script) {
      compileAll(script, function (compiled) {
        if (!compiled) return next();

        cache[url] = compiled;
        succeed(res, compiled);
      });
    });
  };
};

var compileAll = exports.compileAll = function compileAll (script, fn) {
  script.on('loaded', function (noDeps) {
    if (noDeps) {
      return fn(script.src);
    }
    var compiled = [templates.boilerplate]
      , deps = wrapDeps(script);
    for (var k in deps) {
      compiled.push(deps[k]);
    }
    // TODO Make scope be window, not module.exports
    compiled.push(wrapScript(script));
    compiled.push("browserRequire('" + script.name.slice(0, -3) + "');");
    fn(compiled.join("\n"));
  });
  script.load();
};

exports.ScriptPromise = ScriptPromise;

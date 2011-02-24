/**
 * @param {String} name
 * @param {ModulePromise} parent
 */
function ModulePromise (name, parent) {
  this.parents = []; // Who depends on me
  this.name = ModulePath.normalize(name, parent);
  var match = this.name.match(/(\/\.\.)/g);
  this.numLevelsAboveBase = match ? match.length : 0;
  this.basedir = this.name.split('/').slice(0, -1).join('/');
  this.deps = [];
}

ModulePromise.modules = {};

/**
 * @param {String} module name
 * @param {ModulePromise} parent
 */
ModulePromise.from = function (module, parent) {
  if (!parent) {
    return this.modules[module] || (this.modules[module] = new ModulePromise(module));
  } else {
    var name = ModulePath.normalize(module, parent);
    return this.modules[name] || (this.modules[name] = new ModulePromise(module, parent));
  }
};

ModulePromise.prototype = {
  templates: {
      boilerplate: fs.readFileSync(libdir + '/templates/boilerplate.js')
    , injectModule: fs.readFileSync(libdir + '/templates/inject_module.js')
  },

  compile: function (fn, isRoot) {
    var self = this;
    this.loadSrc( function (err, src) {
      if (err) return fn(err);
      var deps = self.depsFor(src)
        , i = deps.length
        , dep;
      self.src = self.templates.injectModule
              .replace(/\$module/g, url).replace('$src', src);
      if (!i) self.loaded();
      else while (i--) {
        dep = ModulePromise.from(deps[i], self);
        self.dependsOn(dep);
        if (!dep.compiled) dep.load();
      }
    });
  },

  /**
   * Passes the unaltered source back to a callback
   * @param {Function} callback
   */
  loadSrc: function (fn) {
    if (this.src) return fn(null, this.src);
    var self = this;
    this.locate( function (err, location) {
      if (err) return fn(err);
      if (!location) return fn(null, null);
      fs.readFile(location, 'utf8', function (err, src) {
        if (err) return fn(err);
        fn(null, src);
      });
    });
  },

  locate: function (fn) {
    if (this.location) return fn(null, this.location);

    var self = this;
    if (NpmModule.npmFlag.test(url)) {
      var npmModule = new NpmModule(url)
        , filepath;
      npmModule.isInstalled(function (err, isInstalled) { // Handle npm modules
        if (err) return fn(err);
        if (isInstalled) {
          npmModule.locate(function (err, location) {
            self.location = location;
            self.asIndex(/\/index\.js$/.test(location));
            fn(null, location);
          });
        } else {
          err = new Error("Could not find " + npmModule.pkgName +
            ". Make sure it's installed via npm.");
          fn(err);
        }
      });
    } else { // Handle local, relative modules
      filepath = path.join(this.baseDir, url);
      path.exists(filepath, function (doesExist) {
        if (doesExist) {
          self.asIndex(/\/index\.js$/.test(location));
          fn(null, filepath);
        } else
          fn(null, null); // Probably a static file
      });
    }
  },

  /**
   * Declare that I depend on another module.
   * Later, when that module is actually loaded,
   * I'll be notified. Once everyone I depend on is loaded,
   * then I will be loaded. Similarly, once I'm loaded,
   * I'll tell those who depend on me that I'm loaded.
   *
   * @param {ModulePromise} module
   * @api public
   */
  dependsOn: function (module) {
    this.deps.push(module.name);
    module.parents.push(this);
  },

  /**
   * Serializes me into a url that can be
   * requested from the server.
   * @return {String}
   * @api public
   */
  url: function () {
    var n = this.numLevelsAboveBase;
    if (n) {
      return this.name + '?n=' + n;
    } else return this.name
  },

  /**
   * This is what I invoke when I a finally want to load myself.
   * I eval my source in the context of module.exports.
   * Then if anyone depends on me, I notify them that I'm loaded.
   */
  loaded: function () {
    if (this.compiled) return;
    var module = {}
      , exports = module.exports = {}
      , self = this;
    (function () {
      try {
        return eval(self.src);
      } catch (e) {
        throw new Error("Something wrong with...\n" + self.src);
      }
    }).call(module.exports);
    this.compiled = module.exports;
    var i = this.parents.length;
    while (i--) {
      this.parents[i].depLoaded(this.name);
    }
  },

  /**
   * Exposes an API for a dependency to tell me that
   * it's loaded.
   *
   * @param {String} name of the module dependency
   */
  depLoaded: function (dep) {
    var deps = this.deps;
    if (dep) deps.splice(deps.indexOf(dep), 1);
    if (!deps.length) this.loaded();
  },

  asIndex: function (isIndex) {
    if (isIndex) {
      this.isIndex = isIndex;
      // Reset the basedir; prior to reset, basedir is name without trailing lastpart.js
      // After the reset, basedir trails with lastpart
      this.basedir = this.name.replace(/\.js$/, '');
    }
  }
};

/**
 * Expose to node
 */
if ('undefined' !== typeof module) {
  module.exports = ModulePromise;
}

var ModulePath = {
  normalize: function (name, parent) {
    if (this.isNormalized(name)) return name;
    return this.isRel(name)
      ? this.normalizeRelToParent(name, parent)
      : name + '.js';
  },
  normalizeRelToParent: function (name, parent) {
    if (!parent) return name;
    var pathparts = parent.isIndex
                  ? parent.basedir.split('/')
                  : (/^\/NPM\/[^\/]+\.js$/).test(parent.name) // if it's /NPM/1degree.js only, then we want /NPM/1degree/name
                    ? parent.name.replace(/\.js$/, '').split('/')
                    : parent.basedir.split('/');
    return this.normalizeRelToDir(name, pathparts);
  },
  normalizeRelToDir: function (name, dirparts) {
    var parts = name.split('/')
      , clonedparts = dirparts.slice(0)
      , aboveBase = false;
    for (var i = 0, l = parts.length, part; i < l; i++) {
      part = parts[i];
      if (part === '.') continue;
      else if (part === '..') {
        if (clonedparts.length === 1) aboveBase = true;
        if (!aboveBase) clonedparts.pop();
        else clonedparts.push(part);
      } else clonedparts.push(part);
    }
    return clonedparts.join('/') + '.js';
  }
};

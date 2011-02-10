function browserRequire (path) {
  var mod = browserRequire.modules[path];
  if (mod && mod.compiled) {
    return mod.compiled;
  }
  throw new Error("Missing module " + path);
}

browserRequire.modules = {};

/**
 * Invoked by JavaScript sent from the server back to the browser.
 * @param {String} module is the brower-require-normalized module name
 * @param {String} src is the JavaScript content to eval
 * @param {Array} deps is an Array of dependencies (strings pointing to modules) that
 *                must load before module can be loaded.
 * @param {Boolean} whether the module was found as module/index.js on the server or not
 */
browserRequire.load = function (module, src, deps, isIndex) {
  var i = deps.length
    , depModule
    , target = ModulePromise.from(module);
  target.src = src;
  if (isIndex) {
    target.isIndex = isIndex;
    // Reset the basedir; prior to reset, basedir is name without trailing lastpart.js
    // After the reset, basedir trails with lastpart
    target.basedir = target.name.replace(/\.js$/, '');
  }
  while (i--) {
    depModule = ModulePromise.from(deps[i], target);
    if (!depModule.compiled) {
      target.dependsOn(depModule);
      browserRequire.modules[depModule.name] = depModule;
      depModule.load();
    }
  }
  if (target.deps.length === 0) {
    target.loaded();
  }
};

var ModulePath = {
  npmPrefix: "/NPM/",
  isNormalized: function (name) {
    return (/^\//).test(name);
  },
  isRel: function (name) {
    return (/^\./).test(name);
  },
  isNpm: function (name) {
    return (/^\/NPM\//).test(name) || !this.isRel(name);
  },
  normalize: function (name, parent) {
    return this.isRel(name)
      ? this.normalizeRelToParent(name, parent)
      : this.npmPrefix + name + '.js';
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

/**
 * @param {String} name
 * @param {ModulePromise} parent
 */
function ModulePromise (name, parent) {
  this.parents = [];
  this.name = ModulePath.isNormalized(name)
    ? name
    : ModulePath.normalize(name, parent);
  var match = this.name.match(/(\/\.\.)/g);
  this.numLevelsAboveBase = match ? match.length : 0;
  this.basedir = this.name.split('/').slice(0, -1).join('/');
  this.deps = [];
}

/**
 * @param {String} module
 * @param {ModulePromise} parent
 */
ModulePromise.from = function (module, parent) {
  if (!parent) {
    return browserRequire.modules[module] || (browserRequire.modules[module] = new ModulePromise(module));
  } else {
    var name = ModulePath.isNormalized(module)
      ? module
      : ModulePath.isRel(module)
        ? ModulePath.normalizeRelToParent(module, parent)
        : ModulePath.npmPrefix + module + '.js';
    return browserRequire.modules[name] || (browserRequire.modules[name] = new ModulePromise(module, parent));
  }
};

ModulePromise.prototype = {
  /**
   * @param {ModulePromise} module
   */
  dependsOn: function (module) {
    this.deps.push(module.name);
    module.parents.push(this);
  },
  load: function () {
    var priorScript = document.getElementsByTagName('script')[0]
      , script = document.createElement('SCRIPT');
    script.async = true;
    script.src = this.url();
    script.onerror = function () {};
    priorScript.parentNode.insertBefore(script, priorScript);
  },

  url: function () {
    var n = this.numLevelsAboveBase;
    if (n) {
      return this.name + '?n=' + n;
    } else return this.name
  },

  /**
   * @param {String} dep
   */
  loaded: function (dep) {
    if (this.compiled) return;
    var deps = this.deps;
    if (dep) deps.splice(deps.indexOf(dep), 1);
    if (!deps.length) {
      var module = { exports: {} }
        , exports = module.exports
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
        this.parents[i].loaded(this.name);
      }
    }
  }
};

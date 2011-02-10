function fluentRequire (path) {
  var mod = fluentRequire.modules[path];
  if (mod && mod.compiled) {
    return mod.compiled;
  }
  throw new Error("Missing module " + path);
}

fluentRequire.modules = {};

/**
 * Invoked by JavaScript sent from the server back to the browser.
 * @param {String} module is the fluent-normalized module name
 * @param {String} src is the JavaScript content to eval
 * @param {Array} deps is an Array of dependencies (strings pointing to modules) that
 *                must load before module can be loaded.
 */
fluentRequire.load = function (module, src, deps) {
  var i = deps.length
    , depModule
    , target = ModulePromise.from(module);
  target.src = src;
  while (i--) {
    depModule = ModulePromise.from(deps[i], target);
    if (!depModule.compiled) {
      target.dependsOn(depModule);
      fluentRequire.modules[depModule.name] = depModule;
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
    var pathparts = parent.basedir.split('/');
    return this.normalizeRelToDir(name, pathparts);
  },
  normalizeRelToDir: function (name, dirparts) {
    var parts = name.split('/')
      , clonedparts = dirparts.slice(0);
    for (var i = 0, l = parts.length, part; i < l; i++) {
      part = parts[i];
      if (part === '.') continue;
      else if (part === '..') clonedparts.pop();
      else clonedparts.push(part);
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
  this.basedir = ModulePath.isNpm(this.name)
    ? this.name.split('/').length > 2
      ? this.name.split('/').slice(0, -1).join('/')
      : this.name.replace(/\.js$/, '')
    : this.name.split('/').slice(0, -1).join('/');
  this.deps = [];
}

ModulePromise.from = function (module, parent) {
  if (!parent) {
    return fluentRequire.modules[module] || (fluentRequire.modules[module] = new ModulePromise(module));
  } else {
    var name = ModulePath.isNormalized(module)
      ? module
      : ModulePath.isRel(module)
        ? ModulePath.normalizeRelToParent(module, parent)
        : ModulePath.npmPrefix + module + '.js';
    return fluentRequire.modules[name] || (fluentRequire.modules[name] = new ModulePromise(module, parent));
  }
};

ModulePromise.prototype = {
  dependsOn: function (module) {
    this.deps.push(module.name);
    module.parents.push(this);
  },
  load: function () {
    var priorScript = document.getElementsByTagName('script')[0]
      , script = document.createElement('SCRIPT');
    script.async = true;
    script.src = this.name;
    script.onerror = function () {};
    priorScript.parentNode.insertBefore(script, priorScript);
  },
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

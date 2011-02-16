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
      depModule.load(function () {
        var priorScript = document.getElementsByTagName('script')[0]
          , script = document.createElement('SCRIPT');
        script.async = true;
        script.src = this.url();
        script.onerror = function () {};
        priorScript.parentNode.insertBefore(script, priorScript);
      });
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

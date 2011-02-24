ModulePromise.prototype.load = function () {
  var priorScript = document.getElementsByTagName('script')[0]
    , script = document.createElement('SCRIPT');
  script.async = true;
  script.src = this.url();
  script.onerror = function () {};
  priorScript.parentNode.insertBefore(script, priorScript);
};

function browserRequire (path) {
  var mod = browserRequire.modules[path]
    , compiled = mod && mod.compiled;
  if (!compiled)
    throw new Error("Missing module " + path);
  return compiled;
}

// Holds ModulePromise instances
browserRequire.modules = ModulePromise.modules;

/**
 * Invoked by JavaScript sent from the server back to the browser.
 * @param {String} module is the brower-require-normalized module name
 * @param {String} src is the JavaScript content to eval
 * @param {Array} deps is an Array of dependencies (strings pointing to 
 * modules) that must load before module can be loaded.
 * @param {Boolean} whether the module was found as module/index.js on the server or not
 */
browserRequire.load = function (module, src, deps, isIndex) {
  var target = ModulePromise.from(module)
    , i = deps.length
    , depModule;
  target.src = src;
  if (isIndex) target.isIndex(isIndex);
  if (!i) target.loaded();
  else while (i--) {
    depModule = ModulePromise.from(deps[i], target);
    if (!depModule.compiled) {
      target.dependsOn(depModule);
      browserRequire.modules[depModule.name] = depModule;
      depModule.load();
    }
  }
};

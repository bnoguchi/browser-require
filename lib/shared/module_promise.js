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
  load: function (fn) {
    fn.call(this, [].slice.call(arguments, 1));
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

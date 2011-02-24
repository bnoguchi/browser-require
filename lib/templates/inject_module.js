browserRequire.modules[$module] = function () {
  var module = {}
    , exports = module.exports = {}
    , require = function (module) {
        if (module.charAt(0) !== '.' && module.charAt(0) !== '/')
          return browserRequire(module);
        var dir = ($dir === '/' ? '.' : $dir)
          , parts = module.split('/')
          , dirparts = dir.split('/')
          , aboveBase = false;
        for (var i = 0, l = parts.length, part; i < l; i++) {
          part = parts[i];
          if (part === '.') continue;
          else if (part === '..') {
            if (dirparts.length === 1) {
              dirparts.pop();
              aboveBase = true;
            }
            if (!aboveBase) dirparts.pop();
            else dirparts.push(part);
          } else dirparts.push(part);
        }
        return browserRequire(dirparts.join('/'));
      };

  (function () {
    $src
  }).call(module.exports);

  return browserRequire.modules[$module].cached = module.exports;
};

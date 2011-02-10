var currdir = $dir;
var require = function (module) {
  var a = ModulePath.isRel(module)
        ? ModulePath.normalizeRelToDir(module, currdir)
        : ModulePath.npmPrefix + module + '.js';
  return browserRequire(a);
}

for (var k in browserRequire) {
  require[k] = browserRequire[k];
}

$src

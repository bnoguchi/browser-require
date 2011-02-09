var currdir = $dir;
var require = function (module) {
  var a = ModulePath.isRel(module)
        ? ModulePath.normalizeRelToDir(module, currdir)
        : ModulePath.npmPrefix + module + '.js';
  return fluentRequire(a);
}

for (var k in fluentRequire) {
  require[k] = fluentRequire[k];
}

$src

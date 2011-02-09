var currdir = $dir;
var require = function (module) {
  var a = ModulePaths.isRel(module)
        ? ModulePaths.normalizeRelToDir(module, currdir)
        : "/NPM/" + module + '.js';
  return fluentRequire(a);
}

for (var k in fluentRequire) {
  require[k] = fluentRequire[k];
}

$src

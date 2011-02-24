function browserRequire (path) {
  var mod = browserRequire.modules[path + '.js'] ||
            browserRequire.modules[path + '/index.js'];
  if (!mod) throw new Error("Missing module " + path);
  return mod.cached || mod();
}
browserRequire.modules = {};

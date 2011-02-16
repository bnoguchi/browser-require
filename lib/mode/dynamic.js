var fs = require('fs')
  , path = require('path')
  , Mode = require('./index');

function DynamicMode () {
  Mode.call(this);
}

DynamicMode.prototype.__proto__ = Mode.prototype;
DynamicMode.prototype.loadSrc = function (url, location, isIndex, fn) {
  var src = fs.readFileSync(location, 'utf8');
  if (url === '/browser_require.js') return fn(null, src);
  src = this.fillinTemplate(url, src, this.depsFor(src), isIndex);
  fn(null, src);
};
DynamicMode.prototype.templates = {
    response: fs.readFileSync(__dirname + '/templates/response.js', 'utf8')
  , src: fs.readFileSync(__dirname + '/templates/src.js', 'utf8')
};
DynamicMode.prototype.fillinTemplate = function (module, src, deps, isIndex) {
  var templates = this.templates
    , dir = isIndex
          ? module.replace(/\.js$/, '').split('/')
          : module.split('/').slice(0, -1)
    , src = templates.src
              .replace('$src', src)
              .replace(/\$dir/g, JSON.stringify(dir));
  return templates.response
    .replace('$module', JSON.stringify(module))
    .replace('$src', JSON.stringify(src))
    .replace('$deps', JSON.stringify(deps))
    .replace('$isIndex', isIndex);
};

DynamicMode.prototype.loadAsset = function (url, fn) {
  url = this.extractUrl(url);
  Mode.prototype.loadAsset.call(this, url, fn);
};

DynamicMode.prototype.locateAsset = function (url, fn) {
  if (url === '/browser_require.js')
    return fn(null, path.dirname(__filename) + '/client/browser_require.js');
  Mode.prototype.locateAsset.call(this, url, fn);
};

/**
 * The incoming url does not always verbatim point to the src file.
 * This is not the case for modules that live above the base dir
 */
DynamicMode.prototype.extractUrl = function (url) {
  // The following continuous block handles incoming requires
  // that exist above the base dir
  var uq = url.split('?')
    , chain = uq[0].split('/')
    , q = uq[1]
    , match
    , nAboveBase;
  // prefix carries ..,..,.. information - i.e., how many levels above
  if (q) {
    match = q.match(/n=([^&]+)/);
    if (match) nAboveBase = parseInt(match[1], 10);
  }
  if (nAboveBase) {
    url = chain.join('/');
    while (nAboveBase--) url = '/..' + url;
  }
  return url;
};

module.exports = DynamicMode;

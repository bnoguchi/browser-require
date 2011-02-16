var fs = require('fs')
  , path = require('path')
  , DynamicMode = require('./mode/dynamic')
  , CompileMode = require('./mode/compile');

module.exports = function exposeRequire (opts) {
  var baseDir = opts.base
    , mode;
  if (opts.compile) {
    mode = new CompileMode(baseDir);
  } else {
    mode = new DynamicMode(baseDir);
  }

  return function (req, res, next) {
    mode.loadAsset(req.url, function (err, src) {
      if (err) {
        console.error(err);
        res.writeHead(404);
        res.end();
      } else if (src) {
        res.writeHead(200, {'Content-Type': 'text/javascript'});
        res.end(src);
      } else {
        next();
      }
    });
  };
};

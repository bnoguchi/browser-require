require.paths.unshift('../../lib');
var path = require('path');
require.paths.unshift(path.join(__dirname, '..', '..'));
var connect = require('connect');
var exposeRequire = require('browser-require');
var app = connect(
  exposeRequire({
    base: __dirname
  }),
  connect.static(__dirname)
);
app.listen(1234);
console.log("Server running at http://127.0.0.1:1234");
process.title = "brtest";

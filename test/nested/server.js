require.paths.unshift('../lib');
var path = require('path');
require.paths.unshift(path.join(__dirname, '..', '..'));
var connect = require('connect');
var app = connect.createServer();
var exposeRequire = require('browser-require');
app.use(exposeRequire({
  base: __dirname
}));
app.use(connect.staticProvider(__dirname));
app.listen(1234);
console.log("Server running at http://127.0.0.1:1234");
process.title = "brtest";

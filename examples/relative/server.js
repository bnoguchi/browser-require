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
console.log("Run the example at http://127.0.0.1:1234/?v=" + (+new Date));

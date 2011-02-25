browser-require
===============

#### The easiest way to require and use CommonJS and NPM modules from your browser

Npm makes it easy to share code on your server. But how many times have you 
wanted to share Javascript code easily between the server and the browser?
`browser-require` allows you to easily use CommonJS and NPM modules defined
on the server in your browser.

browser-require enables you to require both relative (local to your project)
CommonJS modules as well as global NPM modules.

### Installation
To install:
    $ npm install browser-require

### Using browser-require within your connect app

Currently, browser-require depends on the 
[connect](https://github.com/visionmedia/connect/) middleware framework,
if you want to serve client javascript files that contain `require`s.

First, add in the browser-require middleware into your `connect` server:
    var connect = require('connect')
      , app = connect.createServer()
      , exposeRequire = require('browser-require');

    // The following line "app.use(..." is what you want to add to your project
    // Make sure the browser-require middleware comes before staticProvider middleware
    app.use(exposeRequire({
      base: __dirname   // This is where we look to find your non-global modules
    });

    app.use(connect.staticProvider(__dirname));
    app.listen(3000);

On the browser, this is what your index.html might look like:
    <!DOCTYPE html>
    <html>
      <head>
        <title>browser-require example</title>
      </head>
      <body>
        <!-- This is where your custom JavaScript code resides. See README section below -->
        <script type="text/javascript" src="/js/app.js"></script>
      </body>
    </html>

Then in `/js/app.js`, you can require CommonJS and NPM modules as if you are on the server:
    var _ = require('underscore'); // browser-side requires FTW!!!!

    // This should alert "10"
    alert(_.reduce([1, 2, 3, 4], function (sum, num) {
      sum += num;
      return sum;
    }));

### How it works
When you request a javascript file:

1. The server looks up the source and its module dependencies (if any) recursively.
2. Once the server has collected all dependencies, it compiles the top-level file plus
   its dependencies into a file that gets sent back to the browser.

### Command line binary
Sometimes you need to statically compile a set of javascript client files from the command line.
For example, this is necessary if you are building a Chrome plugin. A Chrome plugin can use JavaScript
files that exist inside the Chrome plugin (as opposed to fetching a JavaScript file that exists on the
server). Therefore, it is necessary in this case to compile your JavaScript files and their dependencies
outside of the context of a server.

`browser-require` supports this via a command line binary. You can use it in the following way:
    $ browser-require path/to/js/file.js > path/to/compiled/js/file.js

### Examples
There are examples in the [./examples](https://github.com/bnoguchi/browser-require/tree/master/examples) directory.

To run the relative modules example:
    $ cd examples/relative
    $ node server.js

To run the npm modules example:
    $ npm install underscore
    $ npm install data-structures-js
    $ npm install validator
    $ cd examples/npm
    $ node server.js

### Running the tests
First, make sure the following npm modules are installed, since we will be
using them to test browser-require:
    $ npm install underscore
    $ npm install data-structures-js
    $ npm install validator

First, start up the test server:
    $ make start-test-server

To run tests in Chrome:
    $ make test-chrome

To run tests in Firefox:
    $ make test-firefox

Finally, stop the test server:
    $ make stop-test-server

### Planning on implementing
- A middleware filter mechanism to include things such as a Google Closure Compiler filter.

### Contributors
- [Brian Noguchi](https://github.com/bnoguchi)

### License
MIT License

---
### Author
Brian Noguchi

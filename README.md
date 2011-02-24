browser-require
===============

#### The easiest way to require and use CommonJS and NPM modules from your browser

Npm makes it easy to share code on your server. But how many times have you 
wanted to share Javascript code easily between the server and the browser?
`browser-require` allows you to easily use CommonJS and NPM modules defined
on the server in your browser.

browser-require enables you to require both relative (local to your project)
CommonJS modules as well as global NPM modules.

### Getting started
To install:
    $ npm install browser-require

Currently, browser-require depends on the 
[connect](https://github.com/visionmedia/connect/) middleware framework.

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
        <!-- This is a boilerplate file that you must require -->
        <script type="text/javascript" src="/browser_require.js"></script>

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
Currently, all requires from the browser load JavaScript source and dependencies
from the server in a dynamic, piece-wise, and on-demand fashion.

When you request a javascript file:

1. The server looks up the source and its module dependencies, if any.
2. The server sends back the stringified source (SSRC) and its dependencies.
3. If there are dependencies, then for each dependency, repeat from step 1.
4. Once each javascript file has loaded all its dependencies, then eval and load the SSRC for the file.

The above methodology is great for development environments, where you do not constantly want to
re-compile a javascript file and its dependencies into a single static JavaScript file.

That said, I will be adding static compilation shortly for use in production environments.

Moreover, there are plans to be able to use a hybrid approach for doing both static compilation and
dynamic loading in the same environment, selectively depending on what you want to pre-compile and
what you want to load dynamically.

### Compile mode
browser-require also empowers you to compile everything into a single JavaScript file.

Just change one line.

Inside your `connect` server, add the following line
    compile: true
, so your server file should now look like:
    var connect = require('connect')
      , app = connect.createServer()
      , exposeRequire = require('browser-require');

    // The following line "app.use(..." is what you want to add to your project
    // Make sure the browser-require middleware comes before staticProvider middleware
    app.use(exposeRequire({
        base: __dirname   // This is where we look to find your non-global modules
      , compile: true
    });

Next, just relaunch your server.

You do not need to change anything else. Simplicity at its best.

### How compile mode works
browser-require automatically takes care of converting `/js/app.js`
original source and its dependencies into a single file located at `/js/app.compiled.js`.
Now, when your index.html tries to retrieve `/js/app.js`, browser-require on the server looks it up
at /js/app.compiled.js and returns it contents to the browser as if it were `/js/app.js`.

### Configuration of compile mode
If you want to change how your filename is transformed to become the compiled filename, 
you can do so in the following way:
    app.use(exposeRequire({
        base: __dirname   // This is where we look to find your non-global modules
      , compile: function ($1) {
          // When we have "/js/app.js", $1 is "app"
          // and what we return here replaces "app" with "app.min"
          // so the new destination file becomes "/js/app.min.js"
          return $1 + '.min.';
        }
    });

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
- Static compilation of all CommonJS dependencies into a single JavaScript file.
- A middleware filter mechanism to include things such as a Google Closure Compiler filter.

### Contributors
- [Brian Noguchi](https://github.com/bnoguchi)

### License
MIT License

---
### Author
Brian Noguchi

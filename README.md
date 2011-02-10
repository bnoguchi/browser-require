browser-require
===============

#### The easiest way to require CommonJS and NPM modules in your browser
browser-require

Npm makes it easy to share code on your server. But how many times have you 
wanted to share Javascript code easily between the server and the browser?
`browser-require` allows you to easily use CommonJS and NPM modules defined
on the server in your browser.

### Getting started
To install:
    $ npm install browser-require

Currently, browser-require depends on the 
[connect](https://github.com/visionmedia/connect/) middleware framework.

First, add in the browser-require middleware into your `connect` server:
    var connect = require('connect')
      , app = connect.createServer()
      , brequire = require('browser-require');

    // What to add
    app.use(brequire({
      base: __dirname   // This is where we look to find your non-global modules
    });

    // Make sure brequire middleware comes before staticProvider middleware
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

### Running the tests
First, start up the test server:
    $ make start-test-server
To run tests in Chrome:
    $ make test-chrome
To run tests in Firefox:
    $ make test-firefox
Finally, stop the test server:
    $ make stop-test-server

### Coming soon
- Static compilation of all CommonJS dependencies into a single JavaScript file.

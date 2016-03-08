lasso-tools
===========

The `lasso-tools` module helps building static applications easier
by leveraging [marko](http://markojs.com/) and
[lasso](https://github.com/lasso-js/lasso).

It is both a build tool and runtime development tool.

You use `lasso-tools` by first installing the module into your project.

## Installation

```bash
npm install lasso-tools --save
```

Next add the following files to the root of your project:

- `lasso-project.js`: This file is exports a _project_ that is
   instantiated via:

   ```javascript
   module.exports = require('lasso-tools').project(config);
   ```

- `build.js`: This file is the entry point for your build which done
  via the following command:

  ```bash
  node build.js
  ```

- `server.js`: This file is the entry point for running a local development
  server.

  ```bash
  node build.js
  ```

The contents of these files will be described more thoroughly below.

## Quick Start Guide: Hello World

```bash
mkdir lasso-tools-hello-world
cd lasso-tools-hello-world

git init

npm init

# name: (lasso-tools-hello-world)
# version: (1.0.0)
# description:
# entry point: (build.js)
# test command:
# git repository:
# keywords:
# author:
# license: (ISC)

npm install lasso-tools@1 --save
npm install marko@^3.0.0-rc.1 --save
npm install app-module-path --save
```

## Create Boilerplate Files

### .gitignore

Add a `.gitignore` to the root of your project that contains:

```
.git/
node_modules/
static/
.cache/
*.marko.js
dist/
```

### lasso-project.js

At the root of your project create a `lasso-project.js` file with
the following contents:

```javascript
var PROJECT_NAME = 'lasso-tools-hello-word';

module.exports = require('lasso-tools')
    .project({
        projectDir: __dirname,
        name: PROJECT_NAME
    }, function(config, callback) {
        callback(null, {
            routes: [
                {
                    // The Marko template that will be used to render page
                    template: require.resolve('src/pages/app/index.marko'),

                    // The route path at which this template will be rendered
                    path: '/'
                }
            ]
        });
    })

    // Parse the command-line
    // (parsing will happen when server or build starts
    // but before configuration)
    .parseCommandLine();
```

### build.js

```javascript
// The following line adds the project root directory to the
// module search path which allows you to require modules
// via something similar to:
// require('src/util/ajax.js')
require('app-module-path').addPath(__dirname);

// The following line installs the Node.js require extension
// for `.marko` files. Once installed, `*.marko` files can be
// required just like any other JavaScript modules.
require('marko/node-require').install();

require('./lasso-project')
    // Create a builder
    .build()

    // Start the build
    .start(function(err, result) {
        // build complete
        if (err) {
            throw err;
        }
    });
```

### server.js

```javascript
// The following line adds the project root directory to the
// module search path which allows you to require modules
// via something similar to:
// require('src/util/ajax.js')
require('app-module-path').addPath(__dirname);

// The following line installs the Node.js require extension
// for `.marko` files. Once installed, `*.marko` files can be
// required just like any other JavaScript modules.
require('marko/node-require').install();

require('./lasso-project')
    // We are creating a server from the project
    .server()

    // Start the server
    .start(function(err, server) {
        if (err) {
            throw err;
        }
    });
```

### src/pages/app/index.marko

```html
```

### src/pages/app/browser.json

```json
{
    "dependencies": []
}
```

## Start Server

```bash
node server.js --http-port 8000
```

Open `http://localhost:8888/` and you should see "Hello World!".

## Build Project

**Development build:**

```bash
node build.js
```

**Production build:**

```bash
node build.js --production true
```

## Command Line Help

Help for **server** command:

```bash
node server.js --help
```

Help for **build** command:

```bash
node build.js --help
```
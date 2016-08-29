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

# Install lasso-tools into your project
npm install lasso-tools@latest --save

# Install lasso-babel-transform into your project
npm install lasso-babel-transform@latest --save

# Marko is the templating engine that `lasso-tools` uses
npm install marko@latest --save

# `app-module-path` is used to load modules via absolute paths
# relative to the application root versus always using relative paths.
npm install app-module-path@latest --save

# `browser-refresh` is used to automatically restart the server
# when source file is changed
npm install browser-refresh@latest --save-dev
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

var babelTransform = {
    transform: require('lasso-babel-transform'),
    config: {
        extensions: ['.js', '.es6']
    }
};

module.exports = require('lasso-tools')
    .project({
        projectDir: __dirname,
        name: PROJECT_NAME
    }, function(config, callback) {
        callback(null, {
            routes: [
                // Simple page that uses default lasso configuration:

                {
                    pageName: 'index',

                    // The Marko template that will be used to render page
                    template: require.resolve('src/pages/app/index.marko'),

                    // The route path at which this template will be rendered
                    path: '/'
                }

                // Page with custom lasso configuration:

                // {
                //     pageName: 'hello-world',
                //     template: require.resolve('src/pages/hello-world/index.marko'),
                //     path: '/hello-world',
                //     lasso: this.createLasso({
                //         require: {
                //             transforms: [
                //                 babelTransform
                //             ]
                //         },
                //
                //         // make sure we only have a single bundle file for loading
                //         bundlingEnabled: true,
                //
                //         // all of these bundles are for lazily loaded dependencies
                //         // and should use 'asyncOnly' properly accordingly
                //         bundles: [
                //             // ADD YOUR BUNDLES HERE
                //             // {
                //             //     asyncOnly: true,
                //             //     name: 'polyfills-promises',
                //             //     dependencies: [
                //             //         'bluebird/js/browser/bluebird.core.js'
                //             //     ]
                //             // }
                //         ]
                //     })
                // },

                // Build a JavaScript API (a JavaScript API entry point is
                // not a Marko template):

                // {
                //     // The manifest should have a JavaScript dependency that is
                //     // the entry point.
                //     // For example, add this dependency to `browser.json`:
                //     // {"type": "require", "path": "./index.js", "run": true, "wait": false}
                //     manifest: require.resolve('src/jsapi/v1/browser.json'),
                //     path: '/jsapi-v1.js',
                //     lasso: this.createLasso({
                //         require: {
                //             transforms: [
                //                 babelTransform
                //             ]
                //         },
                //         // make sure we only have a single bundle file for loading
                //         bundlingEnabled: true,
                //
                //         // all of these bundles are for lazily loaded dependencies
                //         // and should use 'asyncOnly' properly accordingly
                //         bundles: [
                //             // ADD YOUR BUNDLES HERE
                //             // {
                //             //     asyncOnly: true,
                //             //     name: 'bluebird',
                //             //     dependencies: [
                //             //         'bluebird/js/browser/bluebird.core.js'
                //             //     ]
                //             // }
                //         ]
                //     })
                // }
            ]
        });
    })

    .lassoConfig({
        require: {
            transforms: [
                babelTransform
            ]
        }
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

    // Extend the configuration to allow custom command-line arguments
    .extendConfig({
        properties: {
            cdnUrl: {
                type: String,
                description: 'CDN URL'
            }
        }
    })

    .onLoadConfig(function(config) {
        this.getLogging().configure({
            loggers: {
                'lasso-tools': 'INFO'
            }
        });

        var cdnUrl = config.getCdnUrl();
        if (cdnUrl) {
            config.setUrlPrefix(url.resolve(cdnUrl, '/' + this.getName() + '/' + this.getVersion() + '/'));
        }
    })

    // Start the build
    .start(function(err, result) {
        // build complete
        if (err) {
            throw err;
        }

        // If you want to do something with the resultant routes, you can
        // use `result.getRoutes()`...
        result.getRoutes().forEach(function(route) {
            console.log('Route: url=' + route.getPath() + ', file=' + route.getFile());
        });
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

    .onLoadConfig(function(config) {
        this.getLogging().configure({
            loggers: {
                'lasso-tools': 'INFO'
            }
        });

        config.setUrlPrefix((config.getSslCert() ? 'https://' : 'http://') +
            'localhost:' + config.getHttpPort() + '/static/');
    })

    // Add a route that is only available at runtime during development
    // (this route won't be part of a static build)
    .route({
        method: 'GET',
        path: '/dev-only',
        handler: function(rest) {
            // forward to the `/hello-world` route
            rest.forwardTo('/hello-world');
        }
    })

    // Start the server
    .start(function(err, server) {
        if (err) {
            throw err;
        }
    });
```

### src/pages/app/index.marko

```
lasso-page package-path="./browser.json" lasso=data.lasso name=data.pageName
<!DOCTYPE html>
html
    head
        meta charset="utf-8"
        title - Hello World
        lasso-head
    body
        lasso-body
        browser-refresh enabled="true"
        init-widgets
```

### src/pages/app/browser.json

```json
{
    "dependencies": []
}
```

## Start Development Server

**Start server without using `browser-refresh`:**

```bash
node server.js --http-port 8000
```

**Start server using `browser-refresh` and with advanced options:**

```bash
BASEDIR=`dirname $0`

MARKO_CLEAN=true node $BASEDIR/node_modules/.bin/browser-refresh "$BASEDIR/server.js" --config config-dev.properties --ssl-cert server.crt --ssl-key server.key
```

Open `http://localhost:8888/` and you should see "Hello World!".

## Build Project

**Development build:**

```bash
# Recommend deleting .cache and dist directory before build
rm -rf dist .cache

node build.js
```

**Production build:**

```bash
# Recommend deleting .cache and dist directory before build
rm -rf dist .cache

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
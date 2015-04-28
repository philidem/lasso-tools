var domain = require('domain');
var send = require('send');
var logger = require('./logging').logger();
var lasso = require('lasso');

var fs = require('fs');

function _cors(rest) {
    // enable CORS support
    var origin = rest.getRequestHeader('Origin');
    if (origin) {
        rest.setResponseHeader('Access-Control-Allow-Origin', origin);
        rest.setResponseHeader('Access-Control-Allow-Credentials', true);
        rest.setResponseHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
        rest.setResponseHeader('Access-Control-Allow-Headers', 'X-SESSIONID,Content-Type,Accept,Origin,User-Agent,Cache-Control,Keep-Alive,X-Requested-With,If-Modified-Since');
    }
}

function _padRight(str, len) {
    if (!len) {
        len = 6;
    }

    while(str.length < len) {
        str += ' ';
    }

    return str;
}

function ServerTool(options) {
    var self = this;
    ServerTool.$super.call(this, options);
    this.Config = require('./ServerConfig');
    this.options.routes = [];

    this.manifestRouteHandler = function(rest) {
        var route = rest.route;
        self.manifestLasso.lassoPage({
            pageName: route.path,
            packagePath: route.manifest
        }, function(err) {
            rest.send('DONE');
        });
    };

    this.templateRouteHandler = function(rest) {
        var route = rest.route;
        route.template.render(route.data, rest.res);
    };
}

ServerTool.prototype = {
    defaultOutputDir: 'static',

    onError: function(err, req, res, rest) {
        logger.error('Error handling request.', err.stack || err);

        try {
            if (rest) {
                rest.error(500, 'Uncaught Exception. ' + err.toString());
            } else {
                res.statusCode = 500;
                res.end();
            }
        } catch(e) {
            // ignore
        }
    },

    handle: function(req, res) {
        var self = this;
        var rest;

        //res.setHeader('Cache-Control', 'no-cache');

        var d = domain.create();

        d.on('error', function(err) {
            self.onError(err, req, res, rest);
        });

        // Because req and res were created before this domain existed,
        // we need to explicitly add them.
        // See the explanation of implicit vs explicit binding below.
        d.add(req);
        d.add(res);

        // Now run the handler function in the domain.
        d.run(function() {
            rest = self.restHandler.handle(req, res);
        });
    },

    handleUpgrade: function(req, socket, head) {
        this.restHandler.handleUpgrade(req, socket, head);
    },

    route: function(routeConfig) {
        this.options.routes.push(routeConfig);

        return this;
    },

    staticRoute: function(urlPrefix, baseDir) {
        var routePath = urlPrefix;
        if (routePath.charAt(routePath.length - 1) !== '/') {
            routePath += '/';
        }

        routePath += '**';

        this.options.routes.push({
            method: 'OPTIONS',

            path: routePath,

            handler: function(rest) {
                _cors(rest);
                rest.setResponseHeader('Access-Control-Max-Age', 1728000);
                rest.setResponseHeader('Content-Type', 'text/plain; charset=UTF-8');
                rest.end();
            }
        });

        this.options.routes.push({
            method: 'GET',

            log: false,

            path: routePath,

            description: 'static ' + urlPrefix + ' => ' + baseDir,

            handler: function(rest) {
                _cors(rest);
                var filePath = rest.params[0];
                var sender = send(rest.req, filePath, {
                    root: baseDir,
                    index: 'index.html'
                });

                sender
                    .on('error', function(err) {
                        logger.error(err);
                        rest.error(err);
                    })
                    .on('directory', function(dir) {
                        sender.path = filePath + '/index.html';
                        sender.pipe(rest.res);
                    })
                    .pipe(rest.res);
            }
        });

        return this;
    },

    proxy: function(target, paths, options) {
        var self = this;
        var HttpProxy = require('./util/HttpProxy');
        var proxy = new HttpProxy(target, options);

        paths.forEach(function(prefix) {
            self.route(proxy.createRoute(prefix));
        });
    },

    start: function(callback) {
        var self = this;

        self._init(function(err) {
            if (err) {
                return callback(err);
            }

            var options = self.options;
            var project = self.getProject();
            var config = self.config;
            var colorsEnabled = config.getColors();

            self.staticRoute(config.getUrlPrefix(), config.getOutputDir());

            var requestLogger = require('./logging').logger('request');

            self.requireFromProject('marko/browser-refresh').enable();
            require('lasso/browser-refresh').enable('*.marko *.css *.less *.png widget.js');

            var restHandler = self.restHandler = require('rest-handler').create()
                .on('route', function(event) {
                    var desc;
                    if (colorsEnabled) {
                        desc = '[route]'.green + ' ' + _padRight(event.method, 6).bold + ' ' + event.route.toString().grey;
                    } else {
                        desc = '[route] ' + _padRight(event.method, 6) + ' ' + event.route.toString();
                    }

                    logger.info(desc);
                })

                .on('beforeHandle', function(rest) {
                    if (rest.route.logRequests === false) {
                        return;
                    }

                    requestLogger.info(rest.req.method + ' ' + rest.req.url);
                })

                .on('routeNotFound', function(req, res) {
                    requestLogger.info('NOT FOUND: ' + req.method + ' ' + req.url);
                });

            var routes = project.routes;

            routes.forEach(function(route) {
                if (!route.handler) {
                    if (route.template) {
                        route.method = route.method || 'GET';
                        route.handler = self.templateRouteHandler;
                    } else if (route.manifest) {
                        route.method = route.method || 'GET';
                        route.handler = self.manifestRouteHandler;
                    }
                }

                restHandler.addRoute(route);
            });

            options.routes.forEach(function(route) {
                restHandler.addRoute(route);
            });

            var ssl = false;
            var httpsOptions;
            var sslCert = config.getSslCert();
            var sslKey = config.getSslKey();
            var httpPort = config.getHttpPort();

            if (sslCert || sslKey) {
                // make sure BOTH cert and key are provided
                if (!sslCert || !sslKey) {
                    logger.error('Both "cert" and "key" arguments are required for SSL support.');
                    process.exit(2);
                }
                httpsOptions = {};
                try {
                    httpsOptions.cert = fs.readFileSync(sslCert);
                } catch (e) {
                    logger.error('Unable to read public x509 certificate file "' + sslCert + '"for SSL support.', e);
                    process.exit(3);
                }
                try {
                    httpsOptions.key = fs.readFileSync(sslKey);
                } catch (e) {
                    logger.error('Unable to read private key file "' + sslKey + '" for SSL support.', e);
                    process.exit(4);
                }
                ssl = true;
            }

            var server;
            if (ssl) {
                server = require('https').createServer(httpsOptions);
            } else {
                server = require('http').createServer();
            }

            server.on('request', function(req, res) {
                self.handle(req, res);
            });

            server.on('upgrade', function(req, socket, head) {
                self.handleUpgrade(req, socket, head);
            });

            logger.info('Starting HTTP server on port ' + httpPort + '...');

            server.on('error', function(err) {
                callback(err);
            });

            // start listening for requests
            server.listen(httpPort, function() {
                logger.info('HTTP server is listening on port ' + httpPort + '.');

                if (process.send) {
            		// We were launched by browser-refresh so tell the parent process
            		// that we are ready...
            		process.send('online');
            	}

                callback(null, server);
            });
        });
    }
};

require('raptor-util').inherit(ServerTool, require('./Tool'));

module.exports = ServerTool;
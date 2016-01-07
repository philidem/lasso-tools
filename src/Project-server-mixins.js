var domain = require('domain');
var send = require('send');
var fs = require('fs');
var logger = require('./logging').logger();
var Integer = require('fashion-model/Integer');
var nodePath = require('path');
var url = require('url');

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

function _onRequsterError(err, req, res, rest) {
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
}

var Model = require('fashion-model/Model');

var ServerOptions = Model.extend({
    properties: {
        routes: [Object],
        routePrefix: String,
        onServer: [Function],
        onRestHandler: [Function]
    }
});

var HttpProxyOptions = Model.extend({
    properties: {
        target: String,
        paths: [String],
        prefix: String,
        allowInsecure: Boolean
    }
});

module.exports = {
    defaultOutputDir: 'static',

    doInit: function() {
        this.setServerOptions(new ServerOptions({
            routes: [],
            onServer: [],
            onRestHandler: []
        }));

        this.extendConfig({
            properties: {
                httpPort: {
                    type: Integer,
                    description: 'HTTP port number to listen on',
                    alias: 'p',
                    defaultValue: 8888
                },

                sslCert: {
                    type: String,
                    description: 'Path to SSL certificate (optional)',
                    defaultValue: undefined
                },

                sslKey: {
                    type: String,
                    description: 'Path to private SSL key (optional)',
                    defaultValue: undefined
                }
            }
        });
    },

    doStart: function(callback) {
        var self = this;

        var projectDir = this.getProjectDir();
        var config = self.getConfig();
        var relativeOutputDir = config.getOutputDir().substring(projectDir.length);

        function routeHandler(rest) {
            self.util.renderRoute(rest.route, rest.res);
        }

        function manifestRouteHandler(rest) {
            var route = rest.route;
            //var config = self.getConfig();

            self.util.renderManifestRoute(route, function(err, result) {
                if (err) {
                    return rest.send(500, err.stack || err.toString());
                }

                _cors(rest);

                var relativePath = result.getUrlByBundleName(route.path)
                    .replace(config.getUrlPrefix(), relativeOutputDir + '/');

                send(rest.req, relativePath, {
                        root: self.getProjectDir()
                    })
                    .on('error', function(err) {
                        logger.error('Error building ' + route.path, err);
                        rest.error(err);
                    })
                    .pipe(rest.res);
            });
        }


        var colorsEnabled = config.getColors();

        var parsedUrl = url.parse(config.getUrlPrefix());
        var urlPath = parsedUrl.pathname;

        self.staticRoute(urlPath, config.getOutputDir());

        var requestLogger = require('./logging').logger('request');

        self.util.requireFromProject('marko/browser-refresh').enable();

        require('lasso/browser-refresh').enable('*.marko *.css *.less *.png widget.js');

        var restHandler = self.restHandler = require('rest-handler').create()
            .on('route', function(event) {
                var desc;
                if (colorsEnabled) {
                    desc = '[route]'.green + ' ' + _padRight(event.method, 7).bold + ' ' + event.route.toString().grey;
                } else {
                    desc = '[route] ' + _padRight(event.method, 7) + ' ' + event.route.toString();
                }

                logger.info(desc);
            })

            .on('beforeHandle', function(rest) {
                if (rest.route.logRequests === false) {
                    return;
                }

                var message = rest.req.method + ' ' + rest.req.url;

                if (rest.forwardFrom) {
                    var forwardFromPaths = [];
                    for (var i = 0; i < rest.forwardFrom.length; i++) {
                        forwardFromPaths.push(rest.forwardFrom[i].path);
                    }
                    message += ' (FORWARDED FROM: ' + forwardFromPaths.join(' -> ') + ')';
                }

                requestLogger.info(message);
            })

            .on('routeNotFound', function(req, res) {
                requestLogger.info('NOT FOUND: ' + req.method + ' ' + req.url);
            });

        this.getServerOptions().getOnRestHandler().forEach(function(onRestHandler) {
            onRestHandler.call(self, restHandler);
        });

        var routes = this.getRoutes();
        var routePrefix = this.getServerOptions().getRoutePrefix();

        function handleRoute(route, routePrefix) {
            if (routePrefix) {
                route.path = nodePath.join('/', routePrefix, route.path);
            }

            if (!route.handler) {
                if (route.template) {
                    route.template = self.util.loadMarkoTemplate(route.template);
                    route.method = route.method || 'GET';
                    route.handler = routeHandler;
                } else if (route.renderer) {
                    route.method = route.method || 'GET';
                    route.handler = routeHandler;
                } else if (route.manifest) {
                    route.method = route.method || 'GET';
                    route.handler = manifestRouteHandler;
                }
            }

            restHandler.addRoute(route);
        }

        logger.info('Loading project routes...');

        routes.forEach(function(route) {
            handleRoute(route, routePrefix);
        });

        logger.info('Loaded project routes.');

        logger.info('Loading server routes...');

        this.getServerOptions().getRoutes().forEach(function(route) {
            handleRoute(route);
        });

        logger.info('Loaded server routes.');

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


        this.getServerOptions().getOnServer().forEach(function(onServer) {
            onServer.call(self, server);
        });

        // start listening for requests
        server.listen(httpPort, function() {
            logger.info('HTTP server is listening on port ' + httpPort + '.');

            if (process.send) {
                // We were launched by browser-refresh so tell the parent process
                // that we are ready...
                process.send('online');
            }

            var selfUri = config.getSslCert() ?
                'https://localhost' :
                'http://localhost';

            selfUri += ':' + config.getHttpPort();

            if (config.getColors()) {
                selfUri = selfUri.white.underline;
            }

            logger.success('LISTENING ON: ' + selfUri);

            callback.call(self, null, server);
        });
    },

    handle: function(req, res) {
        var self = this;
        var rest;

        //res.setHeader('Cache-Control', 'no-cache');

        var d = domain.create();

        d.on('error', function(err) {
            _onRequsterError(err, req, res, rest);
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

    routes: function(routeConfigs) {
        var routes = this.getServerOptions().getRoutes();
        for (var i = 0; i < routeConfigs.length; i++) {
            routes.push(routeConfigs[i]);
        }
        return this;
    },

    route: function(routeConfig) {
        var routes = this.getServerOptions().getRoutes();
        routes.push(routeConfig);
        return this;
    },

    routePrefix: function(routePrefix) {
        this.getServerOptions().setRoutePrefix(routePrefix);
        return this;
    },

    staticRoute: function(urlPrefix, baseDir) {
        var routePath = urlPrefix;
        if (routePath.charAt(routePath.length - 1) !== '/') {
            routePath += '/';
        }

        routePath += '**';

        var serverRoutes = this.getServerOptions().getRoutes();

        serverRoutes.push({
            method: 'OPTIONS',

            path: routePath,

            logRequests: false,

            handler: function(rest) {
                _cors(rest);
                rest.setResponseHeader('Access-Control-Max-Age', 1728000);
                rest.setResponseHeader('Content-Type', 'text/plain; charset=UTF-8');
                rest.end();
            }
        });

        serverRoutes.push({
            method: 'GET',

            path: routePath,

            logRequests: false,

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

    proxy: function(options) {
        var self = this;

        var errors = [];
        options = HttpProxyOptions.wrap(options, errors);
        if (errors.length > 0) {
            throw new Error('Invalid HTTP proxy options: ' + errors.join(', '));
        }

        var HttpProxy = require('./util/HttpProxy');
        var proxy = new HttpProxy(options);

        options.getPaths().forEach(function(path) {
            self.route(proxy.createRoute(path));
        });

        return this;
    },

    onServer: function(handler) {
        this.getServerOptions().getOnServer().push(handler);
        return this;
    },

    onRestHandler: function(handler) {
        this.getServerOptions().getOnRestHandler().push(handler);
        return this;
    }
};
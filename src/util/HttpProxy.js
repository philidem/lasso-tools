var logger = require('../logging').logger(module);
var secureRegex = /\;[ ]*[Ss]ecure/g;
var url = require('url');

function HttpProxy(options) {
    var target = this.target = options.getTarget();
    var targetUrl = url.parse(target);
    var host = targetUrl.hostname;
    if (targetUrl.port) {
        host += ':' + targetUrl.port;
    }

    var prefix = options.getPrefix();

    if (prefix && prefix.charAt(prefix.length - 1) === '/') {
        // trim the trailing slash
        prefix = prefix.substring(0, prefix.length - 1);
    }

    this.prefix = prefix;

    var httpProxy = this._httpProxy = require('http-proxy').createProxyServer({
        target: target,
        secure: false,
        forward: null,
        xfwd: false
    });

    httpProxy.on('error', function(err, req, res) {
        var message = target + ' proxy error.';
        if (req) {
            message += ' ' + req.url;
        }

        logger.error(message, err);

        if (res) {
            res.statusCode = 500;
            res.end('HttpProxy error');
        }
    });

    httpProxy.on('proxyReq', function(request) {
        request.setHeader('Host', host);
    });
    
    if (options.getAllowInsecure()) {
        httpProxy.on('proxyRes', function(response) {
            var setCookie = response.headers['set-cookie'];

            if (setCookie) {
                if (Array.isArray(setCookie)) {
                    for (var i = 0; i < setCookie.length; i++) {
                        setCookie[i] = setCookie[i].replace(secureRegex, '');
                    }
                } else {
                    response.headers['set-cookie'] = setCookie.replace(secureRegex, '');
                }
            }

            delete response.headers['strict-transport-security'];
        });
    }
}

HttpProxy.prototype.createRoute = function(path, options) {
    options = options || {};
    var httpProxy = this._httpProxy;


    if (path.charAt(0) !== '/') {
        // make sure the path starts with a slash
        path = '/' + path;
    }

    var prefixLen = 0;

    if (this.prefix) {
        prefixLen += this.prefix.length;

        // add the prefix to the start of the path
        path = this.prefix + path;
    }

    return {
        path: path,
        method: options.method || '*',
        handler: function(rest) {
            var req = rest.req;
            
            if (prefixLen) {
                req.url = req.url.substring(prefixLen);
            }

            if (rest.isUpgrade()) {
                httpProxy.ws(req, rest.socket, rest.head);
            } else {
                httpProxy.web(req, rest.res);
            }
        }
    };
};

HttpProxy.prototype.on = function(eventType, handler) {
    this._httpProxy.on(eventType, handler);
};

module.exports = HttpProxy;
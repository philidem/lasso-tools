var logger = require('../logging').logger(module);
var secureRegex = /\;[ ]*[Ss]ecure/g;
//var requestHandler = require('src/request-handler');

function HttpProxy(target, options) {
    options = options || {};

    this.target = target;
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

    if (options.allowInsecure) {
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

HttpProxy.prototype.createRoute = function(prefix, options) {
    options = options || {};
    var httpProxy = this._httpProxy;

    return {
        path: prefix,

        method: options.method || '*',

        desc: options.description || ('proxy to ' + this.target),

        handler: function(rest) {
            var req = rest.req;

            if (options.removePrefix) {
                req.url = req.url.substring(prefix.length);
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
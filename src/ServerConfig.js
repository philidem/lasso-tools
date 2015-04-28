var Integer = require('typed-model/Integer');

module.exports = require('./Config').extend({
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
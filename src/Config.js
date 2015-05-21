var LogLevel = require('typed-model/Enum').create({
    values: [
        'DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'
    ],
    autoUpperCase: true
});

module.exports = require('typed-model/Model').extend({
    properties: {
        buildNumber: {
            type: Number,
            description: 'Build number',
            defaultValue: undefined
        },

        colors: {
            type: Boolean,
            description: 'Use color in logging?',
            defaultValue: true
        },

        logLevel: {
            type: LogLevel,
            description: 'Log level (' + LogLevel.values.join(', ') + ')',
            defaultValue: LogLevel.WARN
        },

        minify: {
            type: Boolean,
            description: 'Minify JavaScript and CSS?',
            defaultValue: undefined
        },

        minifyCss: {
            type: Boolean,
            description: 'Minify CSS? (overrides "minify" option)',
            defaultValue: undefined
        },

        minifyJs: {
            type: Boolean,
            description: 'Minify JavaScript? (overrides "minify" option)',
            defaultValue: undefined
        },

        fingerPrintsEnabled: {
            type: Boolean,
            description: 'Fingerprint build artifacts?',
            defaultValue: undefined
        },

        production: {
            type: Boolean,
            description: 'Build for production?',
            defaultValue: false
        },

        flags: {
            type: [String],
            description: 'Build flags',
            defaultValue: ['raptor-logging/browser', 'development']
        },

        outputDir: {
            type: String,
            description: 'Output directory for built files',
            defaultValue: undefined
        },

        urlPrefix: {
            type: String,
            description: 'URL prefix for static assets',
            defaultValue: undefined
        }
    }
});
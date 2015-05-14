/* jshint devel:true */
var nodePath = require('path');
var raptorLogging = require('raptor-logging');
var extend = require('raptor-util/extend');

var _basedir = nodePath.normalize(nodePath.join(__dirname, '..'));
var _colorsEnabled = false;

var _formatArg = function(arg) {
    return arg.toString();
};

function _fixArgs(prefix, args, color) {
    var len = args.length;
    var outIndex = 0;

    if (prefix) {
        len++;
    }

    var outArgs = new Array(len);

    if (prefix) {
        outArgs[outIndex] = prefix;
        outIndex++;
    }

    var i;

    len = args.length;

    for (i = 0; i < len; i++, outIndex++) {
        var arg = args[i];
        if (arg == null) {
            outArgs[outIndex] = arg;
        } else {
            arg = _formatArg(arg);
            if (_colorsEnabled) {
                arg = arg.toString()[color];
            }
            outArgs[outIndex] = arg;
        }
    }

    return outArgs;
}

function Logger_success() {
    var args = _fixArgs(this.prefix, arguments, 'SUCCESS');
    console.log.apply(console, args);
}

function Logger_perf() {
    var args = _fixArgs(this.prefix, arguments, 'PERF');
    console.log.apply(console, args);
}

function Logger_log() {
    var args = _fixArgs(this.prefix, arguments);
    console.log.apply(console, args);
}

function ConsoleAppender() {
}

ConsoleAppender.prototype.log = function(logEvent) {
    var logger = logEvent.logger;

    var prefix = logEvent.logLevel.toString();
    if (_colorsEnabled) {
        prefix = prefix.white;
    }

    if (logger.prefix) {
        prefix += ' ' + logger.prefix;
    } else {
        prefix += ' [' + logEvent.getLoggerName() + ']';

        if (_colorsEnabled) {
            prefix = prefix.grey;
        }
    }

    var args = _fixArgs(prefix, logEvent.args, logEvent.logLevel.name);
    console.log.apply(console, args);
};

raptorLogging.configureAppenders([new ConsoleAppender()]);

var loggers = {};

extend(exports, {
    setBasedir: function(basedir) {
        _basedir = basedir;
    },

    configure: function(config) {
        if (config.loggers) {
            extend(loggers, config.loggers);
            raptorLogging.configure({
                loggers: loggers
            });
        }

        if (config.colors) {
            this.enableColors();
        }
    },

    enableColors: function() {
        // enable colors
        var colors = require('colors');

        colors.setTheme({
            PROMPT: 'grey',
            SUCCESS: 'green',
            PERF: 'magenta',

            // these colors correspond to log level names
            INFO: 'cyan',
            WARN: 'yellow',
            DEBUG: 'cyan',
            TRACE: 'cyan',
            ERROR: 'red'
        });

        _colorsEnabled = true;
    },

    logger: function(moduleOrFilename) {
        var prefix;
        if (moduleOrFilename) {
            if (moduleOrFilename.filename) {
                moduleOrFilename = moduleOrFilename.filename;
            }

            var pos = moduleOrFilename.indexOf(_basedir);
            if (pos !== -1) {
                moduleOrFilename = moduleOrFilename.substring(_basedir.length + 1);
            }

            prefix = '[' + moduleOrFilename + ']';
        } else {
            moduleOrFilename = 'lasso-tools';
        }

        var logger = raptorLogging.logger(moduleOrFilename);
        logger.prefix = '[' + moduleOrFilename + ']';
        logger.success = Logger_success;
        logger.log = Logger_log;
        logger.perf = Logger_perf;

        if (_colorsEnabled) {
            logger.prefix = logger.prefix.grey;
        }

        return logger;
    }
});

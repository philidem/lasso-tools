exports.create = function(project) {
    return {
        name: 'configure-logging',
        start: function(callback) {
            var logging = require('../logging');
            var logger = project.getLogger();

            var config = project.getConfig();
            var logLevel = config.getLogLevel().toString();

            logger.info('Log level: ' + logLevel);

            logging.configure({
                loggers: {
                    'ROOT': logLevel
                },
                colors: config.getColors()
            });

            process.nextTick(callback);
        }
    };
};
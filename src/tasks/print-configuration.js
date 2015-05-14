exports.create = function(project) {
    return {
        name: 'print-configuration',
        start: function(callback) {
            var logger = project.getLogger();
            var config = project.getConfig();
            var colorsEnabled = config.getColors();
            var rawConfig = config.clean();
            logger.info('CONFIGURATION:\n' + Object.keys(rawConfig).map(function(key) {
                var value = rawConfig[key];
                if (value == null) {
                    value = '(not set)';
                    if (colorsEnabled) {
                        value = value.grey;
                    }
                } else {
                    if (colorsEnabled) {
                        value = value.toString().cyan;
                    }
                }

                if (colorsEnabled) {
                    key = key.yellow;
                }

                return '    ' + key + ': ' + value;
            }).join('\n'));
            process.nextTick(callback);
        }
    };
};
var lasso = require('lasso');
var logging = require('./logging');

exports.create = function(project) {
    var logger = project.logger;

    return [
        {
            name: 'configure-logging',
            start: function(callback) {
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
        },
        {
            name: 'configure-marko',
            start: function(callback) {
                var markoCompiler = project.util.requireFromProject('marko/compiler');

                markoCompiler.taglibs.registerTaglib(require.resolve('lasso/marko-taglib.json'));
                markoCompiler.taglibs.registerTaglib(require.resolve('browser-refresh-taglib/marko-taglib.json'));

                process.nextTick(callback);
            }
        },
        {
            name: 'configure-lasso',
            start: function(callback) {
                var config = project.getConfig();

                // Configure the lasso...
                lasso.configure({
                    outputDir: config.getOutputDir(),

                    urlPrefix: config.getUrlPrefix(),

                    // Don't fingerprint files for development
                    fingerprintsEnabled: false,

                    // Don't create bundles for development
                    bundlingEnabled: config.getProduction(),

                    minifyJS: config.getMinifyJs(),

                    minifyCSS: config.getMinifyCss(),

                    // Set appropriate lasso flags for development
                    flags: config.getFlags(),

                    // Use the "development" cache profile
                    cacheProfile: config.getProduction() ? 'production' : 'development',

                    plugins: [
                        {
                            plugin: require('lasso-marko'),
                            config: {
                                compiler: project.util.requireFromProject('marko/compiler')
                            }
                        },
                        require('lasso-less'),
                        require('lasso-image')
                    ]
                });

                // Configure the lasso...
                project.setManifestLasso(lasso.create({
                    outputDir: config.getOutputDir(),

                    urlPrefix: config.getUrlPrefix(),

                    // Don't fingerprint files for development
                    fingerprintsEnabled: false,

                    // Always use bundling for manifests
                    bundlingEnabled: true,

                    minifyJS: config.getMinifyJs(),

                    minifyCSS: config.getMinifyCss(),

                    // Set appropriate lasso flags for development
                    flags: config.getFlags(),

                    // Use the "development" cache profile
                    cacheProfile: config.getProduction() ? 'production' : 'development',

                    plugins: [
                        {
                            plugin: require('lasso-marko'),
                            config: {
                                compiler: project.util.requireFromProject('marko/compiler')
                            }
                        },
                        require('lasso-less'),
                        require('lasso-image')
                    ]
                }, project.getProjectDir()));

                process.nextTick(callback);
            }
        },
        {
            name: 'print-configuration',
            start: function(callback) {
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
        }
    ];
};
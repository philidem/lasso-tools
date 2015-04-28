var extend = require('raptor-util/extend');
var logging = require('./logging');
var resolve = require('resolve');
var fs = require('fs');
var logger = require('./logging').logger();
var lasso = require('lasso');

function _configure(tool) {
    var config = tool.config;
    var Config = config.constructor;

    var key;
    var configFileProperties;
    var args = tool.commandLineArgs;
    var configFile = args.config;

    if (configFile) {
        var fs = require('fs');
        var propertiesParser = require('./util/properties-parser');
        configFileProperties = propertiesParser.parse({
            data: fs.readFileSync(args.config, {encoding: 'utf8'}),
            removeDashes: true
        });

        delete args.config;
        logger.success('Read configuration file: ' + configFile);
    }

    var BooleanType = require('typed-model/Boolean');

    function setValue(key, value, source) {
        var property = Config.getProperty(key);
        if (property) {
            if (property.type === BooleanType) {
                value = (value === true) || (value === 'true');
            }
            config.set(key, value);
        } else {
            logger.warn('Unrecognized configuration property from ' + source + ': ' + key);
        }
    }

    // Create Config with initial values from config file (if available)
    if (configFileProperties) {
        for (key in configFileProperties) {
            if (configFileProperties.hasOwnProperty(key)) {
                setValue(key, configFileProperties[key], configFile);
            }
        }
    }

    // Next, set properties from command line
    for (key in args) {
        if (args.hasOwnProperty(key)) {
            setValue(key, args[key], 'command line');
        }
    }

    // Finally, apply default values
    Config.forEachProperty(function(property) {
        var name = property.getName();
        var value = config.get(name);
        if (value === undefined) {
            config.set(name, property.defaultValue);
        }
    });

    var colorsEnabled = config.getColors();

    if (colorsEnabled) {
        require('colors');
    }
}

function _toArray(value) {
    if (value == null) {
        return [];
    }

    if (Array.isArray(value)) {
        return value;
    }

    return [value];
}

function Tool(options) {
    var self = this;

    // this.data contains data needed beyond initialization
    this.data = {};

    // this.options contains data needed during initialization
    this.options = options = extend({}, options);
    options = this.options = options || {};
    options.userConfig = extend({}, options.config);
    options.examples = options.examples || [];
    options.usage = options.usage || 'Usage: $0 [options]';
    options.validate = options.validate || function(result) {
		if (result.help) {
			this.printUsage();
			process.exit(0);
		}
	};

    options.onConfig = _toArray(options.onConfig);

    options.resolve = {
        basedir: options.projectDir,
        isFile: function(file) {
            var stat;
            try {
                stat = fs.statSync(file);
            } catch (err) {
                return false;
            }
            return stat.isFile() || stat.isFIFO();
        }
    };

    var userTasks = options.tasks;

    options.tasks = [
        {
            name: 'configure-logging',
            type: 'task',
            start: function(callback) {
                var config = self.config;
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
            type: 'task',
            start: function(callback) {
                var markoCompiler = self.requireFromProject('marko/compiler');

        		markoCompiler.taglibs.registerTaglib(require.resolve('lasso/marko-taglib.json'));
                markoCompiler.taglibs.registerTaglib(require.resolve('browser-refresh-taglib/marko-taglib.json'));

                process.nextTick(callback);
            }
        },
        {
            name: 'load-project',
            type: 'task',
            start: function(callback) {
                var factory = require(options.projectFile);
                factory.create(self.config, function(err, project) {
                    if (err) {
                        return callback(err);
                    }

                    self.data.project = project;
                    process.nextTick(callback);
                });
            }
        },
        {
            name: 'configure-lasso',
            type: 'task',
            start: function(callback) {
                var config = self.config;

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
                                compiler: self.requireFromProject('marko/compiler')
                            }
                        },
                        require('lasso-less'),
                        require('lasso-image')
                    ]
                });

                // Configure the lasso...
                self.manifestLasso = lasso.create({
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
                                compiler: self.requireFromProject('marko/compiler')
                            }
                        },
                        require('lasso-less'),
                        require('lasso-image')
                    ]
                }, options.projectDir);

                process.nextTick(callback);
            }
        },
        {
            name: 'print-configuration',
            type: 'task',
            start: function(callback) {
                var config = self.config;
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

    if (userTasks) {
        options.tasks = options.tasks.concat(userTasks);
    }
}

Tool.prototype = {
    requireFromProject: function(moduleName) {
        return require(resolve.sync(moduleName, this.options.resolve));
    },

	extendConfig: function(options) {
		this.Config = this.Config.extend(options);
		return this;
	},

    getProject: function() {
        return this.data.project;
    },

	project: function(project) {
		if (typeof project !== 'string') {
            throw new Error('project must be a module filename or directory');
		}

		this.options.project = project;
		return this;
	},

	usage: function(usage) {
		this.options.usage = usage;
		return this;
	},

	example: function(description, command) {
		this.options.examples.push({
			description: description,
			command: command
		});
		return this;
	},

	parseCommandLine: function() {
        var raptorArgs = {
            '--help': {
                type: 'string',
                description: 'Show this help message'
            },
            '--config -c': {
                type: 'string',
                description: 'Path to configuration file'
            },
            '*': String
        };

        var camelCaseRegex = /[a-z][A-Z]/g;

        this.Config.forEachProperty(function(property) {
            var name = property.getName();

            if (property.commandLine !== false) {
                var dashSeparatedName = name.replace(camelCaseRegex, function(match) {
                    return match.charAt(0) + '-' + match.charAt(1).toLowerCase();
                });

                var raptorArg = {
                    description: property.description
                };

                var raptorArgKey = '--' + dashSeparatedName;
                if (property.alias) {
                    raptorArgKey += ' -' + property.alias;
                }

                if (property.getType() === Boolean) {
                    raptorArg.type = 'boolean';
                }

                raptorArgs[raptorArgKey] = raptorArg;
            }
        });

		var parser = require('raptor-args').createParser(raptorArgs);

		parser.usage(this.options.usage);

		this.options.examples.forEach(function(example) {
			parser.example(example.description, example.command);
		});

		parser.validate(this.options.validate);

		parser.onError(function(err) {
			this.printUsage();
			console.error(err);
			process.exit(1);
		});

		this.commandLineArgs = parser.parse();
		return this;
	},

    configure: function() {
        if (typeof arguments[0] === 'object') {
            extend(this.options.userConfig, arguments[0]);
        }

        var lastArg = arguments[arguments.length - 1];
        if (typeof lastArg === 'function') {

        }

        return this;
    },

    onConfig: function(handler) {
        this.options.onConfig.push(handler);
        return this;
    },

	_init: function(callback) {
        var self = this;
        var options = this.options;
        var fs = require('fs');
        var nodePath = require('path');

        var projectFile = options.project;

        var stats = fs.statSync(projectFile);

        if (stats.isDirectory()) {
            options.projectDir = projectFile;
            options.projectFile = nodePath.join(projectFile, 'lasso-project');
        } else {
            options.projectDir = nodePath.dirname(projectFile);
            options.projectFile = projectFile;
        }

        // configure the resolver to resolve modules relative to the project directory
        options.resolve.basedir = options.projectDir;

        // create the initial config
        var config = this.config = new this.Config(options.userConfig);

        // merge configuration from command line and config file
        _configure(this);

        this.options.onConfig.forEach(function(onConfig) {
            onConfig.call(self, config);
        });

        if (!config.getUrlPrefix()) {
            config.setUrlPrefix('/' + (this.defaultOutputDir || 'static') + '/');
        }

        if (!config.getOutputDir()) {
            config.setOutputDir(nodePath.join(options.projectDir, config.getUrlPrefix(), '/'));
        }

        logging.configure({
            loggers: {
                'ROOT': 'WARN',
                'lasso-tools': 'INFO',
                'request': 'INFO'
            },
            colors: config.getColors()
        });

        var startupTasks = require('task-list').create({
            logger: logger,
            tasks: options.tasks
        });

        startupTasks.startAll(callback);
	}
};

module.exports = Tool;

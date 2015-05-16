var extend = require('raptor-util/extend');
var logging = require('./logging');
var fs = require('fs');
var resolve = require('resolve');
var logger = logging.logger();
var async = require('raptor-async');
var nodePath = require('path');
var lasso = require('lasso');
var _chooseNotNull = require('./util').chooseNotNull;

function _configure(project) {
    var config = project.getConfig();
    var Config = config.constructor;

    var key;
    var configFileProperties;
    var args = project.getOptions().getArgs();
    var configFile = args.config;

    if (configFile) {
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

function _initProject(project, callback) {
    var work = project.getOptions().getWork();

    async.series(work, function(err) {
        if (err) {
            return callback(err);
        }

        // create the initial config
        var config = new project.Config();

        project.setConfig(config);

        // merge configuration from command line and config file
        _configure(project);

        logging.configure({
            loggers: {
                'ROOT': 'INFO',
                'lasso-tools': 'INFO',
                'request': 'INFO'
            },
            colors: config.getColors()
        });

        project.getResolveOptions().basedir = project.getProjectDir();

        project.getOptions().getOnConfig().forEach(function(onConfig) {
            onConfig.call(project, config);
        });

        var defaultOutputDir = (project.defaultOutputDir || 'static');

        if (!config.getUrlPrefix()) {
            config.setUrlPrefix('/' + defaultOutputDir+ '/');
        }

        if (!config.getOutputDir()) {
            config.setOutputDir(nodePath.join(project.getProjectDir(), defaultOutputDir));
        }

        require('task-list').create({
            logger: logger,
            tasks: project.getOptions().getTasks()
        }).startAll(callback);
    });
}

function _parseCommandLine(project) {
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

    project.Config.forEachProperty(function(property) {
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

    var options = project.getOptions();

	parser.usage(options.getUsage());

	options.getExamples().forEach(function(example) {
		parser.example(example.getDescription(), example.getCommand());
	});

	parser.validate(function(result) {
		if (result.help) {
			this.printUsage();
			process.exit(0);
		}
	});

	parser.onError(function(err) {
		this.printUsage();
		console.error(err);
		process.exit(1);
	});

    options.setArgs(parser.parse());
}

var Model = require('typed-model/Model');

var Example = Model.extend({
    properties: {
        description: String,
        command: String
    }
});

var Options = Model.extend({
    properties: {
        usage: String,
        examples: [Example],
        onConfig: [Function],
        args: Object,
        tasks: [Object],
        work: [Function],
        lassoPlugins: [Object],
        lassoBundles: [Object]
    }
});

module.exports = Model.extend({
    properties: {
        projectDir: String,
        name: String,
        version: String,
        routes: [Object],
        options: Options,
        serverOptions: Object,
        resolveOptions: Object,
        factory: Function,

        // Configuration options from command line
        config: require('./Config')
    },

    additionalProperties: true,

    init: function() {
        this.setOptions(new Options({
            tasks: require('./default-tasks').create(this),
            usage: 'Usage: $0 [options]',
            examples: [],
            onConfig: [],
            work: [],
            lassoPlugins: [],
            lassoBundles: []
        }));

        this.setResolveOptions({
            basedir: undefined,
            isFile: function(file) {
                var stat;
                try {
                    stat = fs.statSync(file);
                } catch (err) {
                    return false;
                }
                return stat.isFile() || stat.isFIFO();
            }
        });

        var self = this;

        var projectModules = {};

        this.util = {
            requireFromProject: function(moduleName) {
                return projectModules[moduleName] || (projectModules[moduleName] = require(resolve.sync(moduleName, self.getResolveOptions())));
            },

            loadMarkoTemplate: function(template) {
                if (template.constructor === String) {
                    return this.requireFromProject('marko').load(template);
                } else {
                    return template;
                }
            },

            renderTemplateRoute: function(route, out, callback) {
                route.template.render({
                    route: route
                }, out, function(err) {
                    if (err) {
                        logger.error('Error building ' + route.path);
                    } else {
                        logger.success('Built ' + route.path);
                    }

                    if (callback) {
                        callback(err);
                    }
                });
            },

            renderManifestRoute: function(route, callback) {
                logger.info('Building ' + route.path);

                var theLasso = route.lasso || lasso.getDefaultLasso();

                theLasso.lassoPage({
                    pageName: route.path,
                    packagePath: route.manifest
                }, function(err, result) {
                    if (err) {
                        logger.error('Error building ' + route.path);
                    } else {
                        logger.success('Built ' + route.path);
                    }

                    if (callback) {
                        callback(err, result);
                    }
                });
            }
        };
    },

    prototype: {
        Model: Model,
        Enum: require('typed-model/Enum'),

        getLogger: function() {
            return logger;
        },

        getLogging: function() {
            return logging;
        },

        Config: require('./Config'),

        usage: function(usage) {
            this.getOptions().setUsage(usage);
    		return this;
    	},

    	example: function(description, command) {
    		this.getOptions().getExamples().push({
    			description: description,
    			command: command
    		});
    		return this;
    	},

        onConfigured: function(handler) {
            this.getOptions().getOnConfig().push(handler);
            return this;
        },

        parseCommandLine: function() {
            _parseCommandLine(this);
            return this;
        },

        extendConfig: function(options) {
    		this.Config = this.Config.extend(options);
    		return this;
    	},

        job: function(func) {
            var self = this;
            var work = this.getOptions().getWork();
            if (func.length === 0) {
                work.push(function(callback) {
                    func.call(self);
                    callback();
                });
            } else {
                work.push(func.bind(this));
            }
            return this;
        },

        build: function(func) {
            extend(this, require('./Project-build-mixins'));
            // doInit is provided by mixin
            this.doInit();

            if (func) {
                this.job(func);
            }

            return this;
        },

        server: function(func) {
            extend(this, require('./Project-server-mixins'));
            // doInit is provided by mixin
            this.doInit();

            if (func) {
                this.job(func);
            }

            return this;
        },

        start: function(callback) {
            var self = this;
            _initProject(this, function(err) {
                if (err) {
                    return callback(err);
                }

                self.doStart(callback);
            });
            return this;
        },

        lassoPlugin: function(plugin) {
            this.getOptions().getLassoPlugins().push(plugin);
            return this;
        },

        lassoBundle: function(bundle) {
            this.getOptions().getLassoBundles().push(bundle);
            return this;
        },

        createLassoConfig: function(lassoConfig) {
            var config = this.getConfig();
            var result = extend({}, lassoConfig);

            var minify = _chooseNotNull(config.minify, config.getMinify());

            result.outputDir = _chooseNotNull(result.outputDir, config.getOutputDir());
            result.urlPrefix = _chooseNotNull(result.urlPrefix, config.getUrlPrefix());
            result.fingerprintsEnabled = _chooseNotNull(result.fingerprintsEnabled, config.getFingerPrintsEnabled(), false, config.getProduction());
            result.bundlingEnabled = _chooseNotNull(result.bundlingEnabled, config.getProduction());
            result.minifyJS = _chooseNotNull(result.minifyJS, config.getMinifyJs(), minify, config.getProduction());
            result.minifyCSS = _chooseNotNull(result.minifyCSS, config.getMinifyCss(), minify, config.getProduction());
            result.flags = _chooseNotNull(result.flags, config.getFlags());
            result.cacheProfile = _chooseNotNull(result.cacheProfile,config.getProduction() ? 'production' : 'development');
            result.bundles = _chooseNotNull(result.bundles, this.getOptions().getLassoBundles());
            result.plugins = _chooseNotNull(result.plugins, [
                {
                    plugin: require('lasso-marko'),
                    config: {
                        compiler: this.util.requireFromProject('marko/compiler')
                    }
                },
                require('lasso-less'),
                require('lasso-image')
            ].concat(this.getOptions().getLassoPlugins()));

            return result;
        },

        createLasso: function(lassoConfig) {
            return require('lasso').create(this.createLassoConfig(lassoConfig));
        }
    }
});
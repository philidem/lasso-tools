var extend = require('raptor-util/extend');
var logging = require('./logging');
var fs = require('fs');
var resolve = require('resolve');
var logger = logging.logger();
var async = require('raptor-async');
var nodePath = require('path');
var lasso = require('lasso');
var _chooseNotNull = require('./util').chooseNotNull;
var raptorRenderer = require('raptor-renderer');
var asyncWriter = require('async-writer');

function _configure(project) {
    var config = project.getConfig();
    var Config = config.constructor;

    var key;
    var configFileProperties;
    var args;
    var configFile;

    if (project.getOptions().getParseCommandLine()) {
        args = _parseCommandLine(project);
    }

    if (args) {
        configFile = args.config;

        if (configFile) {
            var propertiesParser = require('./util/properties-parser');
            configFileProperties = propertiesParser.parse({
                data: fs.readFileSync(args.config, {encoding: 'utf8'}),
                removeDashes: true
            });

            delete args.config;
            logger.success('Read configuration file: ' + configFile);
        }
    }

    var BooleanType = require('fashion-model/Boolean');

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
    if (args) {
        for (key in args) {
            if (args.hasOwnProperty(key)) {
                setValue(key, args[key], 'command line');
            }
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

        project.getResolveOptions().basedir = project.getProjectDir();

        if (!project.getVersion()) {
            try {
                var packageJson = project.util.requireFromProject('./package.json');
                project.setVersion(packageJson.version);
            } catch(e) {
                // ignore
            }
        }

        var buildNumber = project.getConfig().getBuildNumber();
        if (buildNumber && project.getVersion()) {
            var regex = /(\d+\.\d+\.)\d+(\-.*)?/;
            var match = regex.exec(project.getVersion());
            if (match) {
                project.setVersion(match[1] + buildNumber + (match[2] || ''));
            }
        }

        logging.configure({
            loggers: {
                'ROOT': 'INFO',
                'lasso-tools': 'INFO',
                'request': 'INFO'
            },
            colors: config.getColors()
        });



        project.getOptions().getOnLoadConfig().forEach(function(onLoadConfig) {
            onLoadConfig.call(project, config);
        });

        var defaultOutputDir = (project.defaultOutputDir || 'static');

        if (!config.getUrlPrefix()) {
            config.setUrlPrefix('/' + defaultOutputDir + '/');
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

    var args = parser.parse();
    options.setArgs(args);

    return args;
}

var Model = require('fashion-model/Model');

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
        onLoadConfig: [Function],
        onLoadProject: [Function],
        args: Object,
        tasks: [Object],
        work: [Function],
        lassoConfig: Object,
        lassoPlugins: [Object],
        lassoBundles: [Object],
        parseCommandLine: Boolean
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
        var options = new Options();

        options.setTasks(require('./default-tasks').create(this));
        options.setUsage('Usage($0 [options]');
        options.setExamples([]);
        options.setOnLoadConfig([]);
        options.setOnLoadProject([]);
        options.setWork([]);
        options.setLassoPlugins([]);
        options.setLassoBundles([]);
        options.setParseCommandLine(false);

        this.setOptions(options);

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
                var requiredModule = projectModules[moduleName];
                if (!requiredModule) {
                    var modulePath = resolve.sync(moduleName, self.getResolveOptions());
                    projectModules[moduleName] = requiredModule = require(modulePath);
                    // logger.debug('Required ' + modulePath);
                }

                return requiredModule;
            },

            loadMarkoTemplate: function(template) {
                if (template.constructor === String) {
                    return this.requireFromProject('marko').load(template);
                } else {
                    return template;
                }
            },

            renderRoute: function(route, out, callback) {
                logger.info('Building page ' + route.path);

                var input = {
                    route: route,
                    project: self,
                    lasso: route.lasso || lasso.getDefaultLasso(),
                    pageName: route.pageName || route.path
                };

                input.$global = input;

                out.on('error', function(err) {
                    //logger.error('Error building page ' + route.path, err);

                    if (callback) {
                        callback(err);
                    }
                });

                out.on('finish', function() {
                    logger.success('Built page ' + route.path);

                    if (callback) {
                        callback();
                    }
                });

                if (route.renderer) {
                    var asyncOut = asyncWriter.create(out);
                    raptorRenderer.render(route.renderer, input, asyncOut);
                } else if (route.template) {
                    route.template.render(input, out);
                }
            },

            renderManifestRoute: function(route, callback) {
                logger.info('Building manifest route ' + route.path);

                var theLasso = route.lasso || lasso.getDefaultLasso();

                theLasso.lassoPage({
                    pageName: route.pageName || route.path,
                    packagePath: route.manifest,
                    data: {
                        route: route,
                        project: self
                    }
                }, function(err, result) {
                    if (err) {
                        logger.error('Error building manifest route' + route.path, err);
                    } else {
                        logger.success('Built manifest route ' + route.path);
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
        Enum: require('fashion-model/Enum'),

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

        onLoadConfig: function(handler) {
            this.getOptions().getOnLoadConfig().push(handler);
            return this;
        },

        onLoadProject: function(handler) {
            this.getOptions().getOnLoadProject().push(handler);
            return this;
        },

        parseCommandLine: function(parse) {
            this.getOptions().setParseCommandLine(parse !== false);
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

        lassoBundles: function(bundles, options) {
            for (var i = 0; i < bundles.length; i++) {
                var bundle = bundles[i];
                if (options) {
                    bundle = extend({}, bundle);
                    extend(bundle, options);
                }
                this.getOptions().getLassoBundles().push(bundle);
            }
            return this;
        },


        lassoConfig: function(lassoConfig) {
            this.getOptions().setLassoConfig(lassoConfig);
            return this;
        },

        createLassoConfig: function(lassoConfig) {
            var config = this.getConfig();
            var result = extend({}, lassoConfig);

            var minify = _chooseNotNull(config.minify, config.getMinify());

            result.noConflict = result.noConflict || this.getName();
            result.outputDir = _chooseNotNull(result.outputDir, config.getOutputDir());
            result.urlPrefix = _chooseNotNull(result.urlPrefix, config.getUrlPrefix());
            result.bundlingEnabled = _chooseNotNull(result.bundlingEnabled, config.getProduction());
            result.fingerprintsEnabled = _chooseNotNull(result.fingerprintsEnabled, config.getFingerPrintsEnabled(), result.bundlingEnabled);
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
        },

        apply: function(projectData) {
            var self = this;
            var errors = [];
            var Project = this.constructor;
            Object.keys(projectData).forEach(function(key) {
                if (Project.properties[key]) {
                    self.set(key, projectData[key], errors);
                }
            });

            if (errors.length) {
                throw new Error('Invalid project configuration: ' + errors.join(', '));
            }

            return this;
        }
    }
});
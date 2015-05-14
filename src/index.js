var lassoTools = exports;

var Project = require('./Project');
lassoTools.project = function(projectDir, factory) {
    var logger = require('./logging').logger();

    if (typeof projectDir !== 'string') {
        projectDir = require('app-root-dir').get();
    }

    logger.info('Project Directory: ' + projectDir);

    factory = arguments[arguments.length - 1];

    return new Project({
        projectDir: projectDir,
        factory: factory
    });
};
var lassoTools = exports;
var extend = require('raptor-util/extend');

var Project = require('./Project');
lassoTools.project = function(projectData, factory) {
    require('./logging').configure({
        loggers: {
            'lasso-tools': 'INFO'
        }
    });

    var logger = require('./logging').logger();

    if (typeof projectData === 'object') {
        extend({}, projectData);
    } else {
        projectData = {};
    }


    if (!projectData.projectDir) {
        projectData.projectDir = require('app-root-dir').get();
    }

    logger.info('Project Directory: ' + projectData.projectDir);

    factory = arguments[arguments.length - 1];

    if (typeof factory === 'function') {
        projectData.factory = factory;
    }

    var project = new Project();

    project.apply(projectData);

    return project;
};
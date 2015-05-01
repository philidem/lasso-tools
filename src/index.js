var lassoTools = exports;

var Project = require('./Project');
lassoTools.project = function(factory) {
    return new Project({
        factory: factory
    });
};
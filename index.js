var lassoTools = exports;

lassoTools.Model = require('typed-model/Model');

lassoTools.Enum = require('typed-model/Enum');

lassoTools.server = function(options) {
    var ServerTool = require('./src/ServerTool');
    return new ServerTool(options);
};

lassoTools.builder = function(options) {
    var BuildTool = require('./src/BuildTool');
    return new BuildTool(options);
};
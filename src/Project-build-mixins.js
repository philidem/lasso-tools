var async = require('raptor-async');
var nodePath = require('path');
var fs = require('fs');
var mkdirp = require('mkdirp');

function _createBuildTemplateJob(project, route) {
    var config = project.getConfig();
    route.template = project.util.loadMarkoTemplate(route.template);

    return function(callback) {
        var logger = project.getLogger();
        logger.info('Building ' + route.path);

        var outputDir = config.getOutputDir();
        var pageDir = nodePath.join(outputDir, route.path);
        var outputFile = nodePath.join(pageDir, 'index.html');

        mkdirp.sync(pageDir);

        var out = fs.createWriteStream(outputFile);
        project.util.renderTemplateRoute(route, out, callback);
    };
}

function _createBuildManifestJob(project, route) {
    return function(callback) {
        project.util.renderManifestRoute(route, function(err, result) {
            if (err) {
                return callback(err);
            }

            var outputFile = result.getFileByBundleName(route.path);

            if (!outputFile) {
                return callback();
            }

            var config = project.getConfig();
            var outputDir = config.getOutputDir();
            var oldPath = outputFile;
            var newPath = nodePath.join(outputDir, route.path);

            mkdirp(nodePath.dirname(newPath), function(err) {
                if (err) {
                    return callback(err);
                }

                fs.rename(oldPath, newPath, callback);
            });
        });
    };
}

module.exports = {
    defaultOutputDir: 'dist',

    doInit: function() {
        this.extendConfig({
            properties: {

            }
        });
    },

    doStart: function(callback) {
        var self = this;
        var work = [];
        var routes = this.getRoutes();
        var errors = [];

        routes.forEach(function(route, index) {
            if (route.template) {
                work.push(_createBuildTemplateJob(self, route));
            } else if (route.manifest) {
                work.push(_createBuildManifestJob(self, route));
            } else {
                errors.push(new Error('Invalid route: ' + (route.name || ('#' + index))));
            }
        });

        if (errors.length) {
            return callback(new Error(errors.join('. ')));
        }

        async.series(work, callback);
    }
};
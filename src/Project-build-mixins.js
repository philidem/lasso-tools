var async = require('raptor-async');
var nodePath = require('path');
var fs = require('fs');
var mkdirp = require('mkdirp');
var BuildResult = require('./BuildResult');

function _createBuildTemplateJob(project, route, buildResult) {
    var config = project.getConfig();
    route.template = project.util.loadMarkoTemplate(route.template);

    return function(callback) {
        var logger = project.getLogger();
        logger.info('Building ' + route.path);

        var outputDir = config.getOutputDir();

        var relativeFilePath = nodePath.join(route.path, 'index.html');
        
        var pageDir = nodePath.join(outputDir, route.path);
        var outputFile = nodePath.join(outputDir, relativeFilePath);

        buildResult.addRoute({
            url: route.path,
            path: route.path,
            file: relativeFilePath
        });

        mkdirp.sync(pageDir);

        var out = fs.createWriteStream(outputFile);
        project.util.renderTemplateRoute(route, out, callback);
    };
}

function _createBuildManifestJob(project, route, buildResult) {
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

                buildResult.addRoute({
                    url: result.getUrlByBundleName(route.path),
                    path: route.path,
                    file: route.path
                });

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

        var buildResult = new BuildResult();
        buildResult.setProject(this);

        var resultRoutes = [];

        buildResult.setRoutes(resultRoutes);

        routes.forEach(function(route, index) {
            if (route.template) {
                work.push(_createBuildTemplateJob(self, route, buildResult));
            } else if (route.manifest) {
                work.push(_createBuildManifestJob(self, route, buildResult));
            } else {
                errors.push(new Error('Invalid route: ' + (route.name || ('#' + index))));
            }
        });

        if (errors.length) {
            return callback(new Error(errors.join('. ')));
        }

        async.series(work, function(err) {
            callback(err, buildResult);
        });
    }
};
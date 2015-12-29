var async = require('raptor-async');
var nodePath = require('path');
var fs = require('fs');
var mkdirp = require('mkdirp');
var BuildResult = require('./BuildResult');

function _createRouteBuildJob(project, route, buildResult) {
    var config = project.getConfig();

    if (route.template) {
        route.template = project.util.loadMarkoTemplate(route.template);
    }

    return function(callback) {
        var logger = project.getLogger();


        var outputDir = config.getOutputDir();
        var routePath = route.path;

        var relativeFilePath = route.path;
        var pageDir;

        if (route.path.charAt(routePath.length - 1) === '/') {
            // route path is for a "directory" so use index page
            relativeFilePath = nodePath.join(routePath, 'index.html');
            pageDir = nodePath.join(outputDir, routePath);
        } else {
            // route path is for a "file" (no need for index page)
            pageDir = nodePath.join(outputDir, nodePath.dirname(routePath));
        }

        // normalize file system paths
        relativeFilePath = nodePath.normalize(relativeFilePath);
        pageDir = nodePath.normalize(pageDir);

        var outputFile = nodePath.join(outputDir, relativeFilePath);

        logger.info('Building ' + routePath + ' to ' + outputFile + '...');

        buildResult.addRoute({
            url: routePath,
            path: routePath,
            file: relativeFilePath
        });

        mkdirp.sync(pageDir);

        var out = fs.createWriteStream(outputFile);
        project.util.renderRoute(route, out, callback);
    };
}

function _createManifestRouteBuildJob(project, route, buildResult) {
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
            var newPath = nodePath.normalize(nodePath.join(outputDir, route.path));

            mkdirp(nodePath.dirname(newPath), function(err) {
                if (err) {
                    return callback(err);
                }

                buildResult.addRoute({
                    url: result.getUrlByBundleName(route.path),
                    path: route.path,
                    file: route.path
                });

                var source = fs.createReadStream(oldPath);
                var destination = fs.createWriteStream(newPath);

                var errorHandled = false;

                function onError(err) {
                    if (errorHandled) {
                        return;
                    }

                    errorHandled = true;
                    callback(err);
                }

                source.on('error', onError);
                destination.on('error', onError);

                destination.on('finish', function() {
                    callback();
                });

                fs.createReadStream(oldPath).pipe(destination);
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
            if (route.template || route.renderer) {
                work.push(_createRouteBuildJob(self, route, buildResult));
            } else if (route.manifest) {
                work.push(_createManifestRouteBuildJob(self, route, buildResult));
            } else {
                errors.push(new Error('Invalid route: ' + (route.name || ('#' + index))));
            }
        });

        if (errors.length) {
            return callback(new Error(errors.join('. ')));
        }

        async.series(work, function(err) {
            callback.call(self, err, buildResult);
        });
    }
};
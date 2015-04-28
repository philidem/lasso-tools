var async = require('raptor-async');
var nodePath = require('path');
var fs = require('fs');
var mkdirp = require('mkdirp');


function BuildTool(options) {
    BuildTool.$super.call(this, options);
    this.Config = require('./BuildConfig');
}

BuildTool.prototype = {
    defaultOutputDir: 'static',

    createBuildTemplateJob: function(route) {
        var config = this.config;

        return function(callback) {
            var outputDir = config.getOutputDir();
            var pageDir = nodePath.join(outputDir, route.path);
            var outputFile = nodePath.join(pageDir, 'index.html');

            mkdirp.sync(pageDir);

            var out = fs.createWriteStream(outputFile);

            route.template.render(route.data, out, callback);
        };
    },

    createBuildManifestJob: function(route) {
        return function(callback) {
            callback();
        };
    },

    build: function(callback) {
        var self = this;

        this._init(function(err) {
            if (err) {
                return callback(err);
            }

            var work = [];
            var project = self.getProject();
            var routes = project.routes;
            var errors = [];

            routes.forEach(function(route, index) {
                if (route.template) {
                    work.push(self.createBuildTemplateJob(route));
                } else if (route.manifest) {
                    work.push(self.createBuildManifestJob(route));
                } else {
                    errors.push(new Error('Invalid route: ' + (route.name || ('#' + index))));
                }
            });

            if (errors.length) {
                return callback(new Error(errors.join('. ')));
            }

            async.series(work, callback);
        });
    }
};

require('raptor-util').inherit(BuildTool, require('./Tool'));

module.exports = BuildTool;
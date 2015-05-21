exports.create = function(project) {
    return {
        name: 'load-project',
        start: function(callback) {
            var projectFactory = project.getFactory();
            var config = project.getConfig();
            projectFactory.call(project, config, function(err, projectData) {
                if (err) {
                    return callback(err);
                }

                var errors = [];
                var Project = project.constructor;
                Object.keys(projectData).forEach(function(key) {
                    if (Project.properties[key]) {
                        project.set(key, projectData[key], errors);
                    }
                });

                if (errors.length) {
                    return callback(new Error('Project errors: ' + errors.join(', ')));
                }

                if (!project.getVersion()) {
                    try {
                        project.setVersion(project.util.requireFromProject('./package.json'));
                    } catch(e) {
                        project.setVersion('0.0.0');
                    }
                }

                var buildNumber = project.getConfig().getBuildNumber();
                if (buildNumber) {
                    var regex = /(\d+\.\d+\.)\d+(\-.*)?/;
                    var match = regex.exec(project.getVersion());
                    if (match) {
                        project.setVersion(match[1] + buildNumber + (match[2] || ''));
                    }
                }

                var logger = project.getLogger();

                logger.info('Project: ' + project.getName() + ' ' + project.getVersion());

                project.getOptions().getOnLoadProject().forEach(function(onLoadProject) {
                    onLoadProject.call(project, project);
                });

                process.nextTick(callback);
            });
        }
    };
};
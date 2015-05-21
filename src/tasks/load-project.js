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

                if (projectData) {
                    project.apply(projectData);
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
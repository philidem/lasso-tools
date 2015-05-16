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

                callback();
            });
        }
    };
};
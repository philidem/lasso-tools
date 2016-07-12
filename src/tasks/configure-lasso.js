exports.create = function(project) {
    return {
        name: 'configure-lasso',
        start: function(callback) {
            // Configure the default lasso...
            var lassoConfig = project.getOptions().getLassoConfig();

            require('lasso').configure(
                project.createLassoConfig(lassoConfig),
                project.getProjectDir());

            process.nextTick(callback);
        }
    };
};
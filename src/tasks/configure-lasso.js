exports.create = function(project) {
    return {
        name: 'configure-lasso',
        start: function(callback) {
            // Configure the default lasso...
            require('lasso').configure(project.createLassoConfig(), project.getProjectDir());

            process.nextTick(callback);
        }
    };
};
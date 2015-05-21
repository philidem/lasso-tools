


exports.create = function(project) {
    return [
        require('./tasks/configure-logging').create(project),
        require('./tasks/load-project').create(project),
        require('./tasks/configure-marko').create(project),
        require('./tasks/configure-lasso').create(project),
        require('./tasks/print-configuration').create(project)
    ];
};
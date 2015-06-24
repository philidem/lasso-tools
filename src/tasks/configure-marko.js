exports.create = function(project) {
    return {
        name: 'configure-marko',
        start: function(callback) {
            var markoCompiler = project.util.requireFromProject('marko/compiler');

            // Since we are registering new taglibs, clear any cached lookups
            // (this is necessary if there were templates that were compiled before
            // we registered these taglibs which could cause taglibs to be cached)
            markoCompiler.taglibs.clearCaches();
            
            markoCompiler.taglibs.registerTaglib(require.resolve('lasso/marko-taglib.json'));
            markoCompiler.taglibs.registerTaglib(require.resolve('browser-refresh-taglib/marko-taglib.json'));

            process.nextTick(callback);
        }
    };
};
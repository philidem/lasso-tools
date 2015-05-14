exports.create = function(project) {
    return {
        name: 'configure-marko',
        start: function(callback) {
            var markoCompiler = project.util.requireFromProject('marko/compiler');

            markoCompiler.taglibs.registerTaglib(require.resolve('lasso/marko-taglib.json'));
            markoCompiler.taglibs.registerTaglib(require.resolve('browser-refresh-taglib/marko-taglib.json'));

            process.nextTick(callback);
        }
    };
};
exports.create = function(project) {
    return {
        name: 'configure-lasso',
        start: function(callback) {
            var lasso = require('lasso');
            
            var config = project.getConfig();

            var plugins = [
                {
                    plugin: require('lasso-marko'),
                    config: {
                        compiler: project.util.requireFromProject('marko/compiler')
                    }
                },
                require('lasso-less'),
                require('lasso-image')
            ].concat(project.getOptions().getLassoPlugins());

            // Configure the lasso...
            lasso.configure({
                outputDir: config.getOutputDir(),

                urlPrefix: config.getUrlPrefix(),

                // Don't fingerprint files for development
                fingerprintsEnabled: false,

                // Don't create bundles for development
                bundlingEnabled: config.getProduction(),

                minify: config.getMinify(),

                minifyJS: config.getMinifyJs(),

                minifyCSS: config.getMinifyCss(),

                // Set appropriate lasso flags for development
                flags: config.getFlags(),

                // Use the "development" cache profile
                cacheProfile: config.getProduction() ? 'production' : 'development',

                plugins: plugins
            });

            // Configure the lasso...
            project.setManifestLasso(lasso.create({
                outputDir: config.getOutputDir(),

                urlPrefix: config.getUrlPrefix(),

                // Don't fingerprint files for development
                fingerprintsEnabled: false,

                // Always use bundling for manifests
                bundlingEnabled: true,

                minifyJS: config.getMinifyJs(),

                minifyCSS: config.getMinifyCss(),

                // Set appropriate lasso flags for development
                flags: config.getFlags(),

                // Use the "development" cache profile
                cacheProfile: config.getProduction() ? 'production' : 'development',

                plugins: [
                    {
                        plugin: require('lasso-marko'),
                        config: {
                            compiler: project.util.requireFromProject('marko/compiler')
                        }
                    },
                    require('lasso-less'),
                    require('lasso-image')
                ]
            }, project.getProjectDir()));

            process.nextTick(callback);
        }
    };
};
var Model = require('fashion-model/Model');

var Route = Model.extend({
    properties: {
        url: String,
        path: String,
        file: String
    }
});

module.exports = Model.extend({
    properties: {
        project: require('./Project'),
        routes: [Route]
    },

    prototype: {
        addRoute: function(route) {
            this.getRoutes().push(Route.wrap(route));
        }
    }
});
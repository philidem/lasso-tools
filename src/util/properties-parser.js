var lineRegex = /^([a-zA-Z\- ]+)=(.*)$/mg;
var dashSeparatedRegex = /\-[a-zA-Z]/g;
exports.parse = function(options, callback) {
    var data = options.data;

    var removeDashes = (options.removeDashes === true);

    var properties = {};

    data.replace(lineRegex, function(match, name, value) {
        value = value.trim();
        if (value.charAt(0) === '#') {
			// line is commented-out
			return;
		}

        name = name.trim();

        if (removeDashes) {
            name = name.replace(dashSeparatedRegex, function(match) {
                return match.charAt(1).toUpperCase();
            });
        }

        properties[name] = value;
    });

    return properties;
};

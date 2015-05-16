exports.chooseNotNull = function() {
    for (var i = 0; i < arguments.length; i++) {
        var value = arguments[i];
        if (value != null) {
            return value;
        }
    }

    return undefined;
};
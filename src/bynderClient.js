var request = require('request');

module.exports = function (options) {

    var decorate = function (requestOptions) {
        if (typeof requestOptions === 'string') {
            requestOptions = {uri: requestOptions};
        }
        requestOptions.oauth = options.credentials;
        requestOptions.baseUrl = options.baseUrl;
        //requestOptions.proxy = '';
        requestOptions.timeout = 1000 * 120;
        return requestOptions;
    };

    /**
     * Generic response handler that parses the JSON
     * That probably should be a request middleware
     *
     * @param cb
     * @returns {Function}
     */
    var response = function (cb) {
        return function (err, res, body) {
            if (err) {
                console.error(err);
                return cb(err, null, res);
            }

            var json;
            try {
                json = JSON.parse(body);
            } catch (err) {
                return cb(err, body, res);
            }

            return cb(err, json, res)
        }
    };

    return {

        // make the brand ID a const of the Bynder Client object.
        // definitely not a good choice if we need to do multi-brand
        brandId: options.brandId,

        defaultUploadEndpoint: options.defaultUploadEndpoint,

        get: function (opts, cb) {
            return request.get(decorate(opts), response(cb));
        },
        post: function (opts, cb) {
            return request.post(decorate(opts), response(cb));
        },
        delete: function (opts, cb) {
            return request.delete(decorate(opts), response(cb));
        }
    }
};
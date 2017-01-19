var async = require('async');
module.exports = function (bynder) {


    var _metaproperties;

    /**
     * Calls the metaproperties API which returns an object with all meta properties.
     * In order to reduce useless network usage, the result is cached in the _metaproperties local var
     *
     * This variable is overriden on runtime by the "createOption" function, which performs
     * an optimistic push inside metaproperties' options
     * @see createOption
     * @param cb
     */
    var getAll = function (cb) {

        if (_metaproperties) {
            return cb(_metaproperties);
        }

        bynder.get('v4/metaproperties/', function (err, metaproperties) {
            _metaproperties = metaproperties;
            cb(_metaproperties);
        });
    };

    /**
     * Because you can ask for the creation of an option while it's
     * being created, we store the callbacks in this map.
     * When the option is finally created, all registered callbacks are called
     *
     * @type {{Function}}
     */
    var optCreatedCbs = {};

    /**
     * Create a new option for an existing MetaProperty.
     *
     * @param prop {Object} {id: XXXX-XX-XXXX, options: []} taken from the /metaproperties API Call
     * @param prop.id {String} XXXX-XX-XXXX
     * @param prop.name {String}
     * @param prop.options {Array}
     * @param option {Object} {name: '', label: ''} TODO add labels
     * @param option.id {String}
     * @param option.name {String}
     * @param option.label {String}
     * @param cb Function returns the option ID
     */
    var createOption = function (prop, option, cb) {

        function release() {
            optCreatedCbs[prop.id][option.name].forEach(function (optionListener) {
                optionListener();
            });
        }

        if (typeof optCreatedCbs[prop.id] === 'undefined') {
            optCreatedCbs[prop.id] = [];
        }

        if (!option || !option.name) {
            return cb();
        }

        if (typeof optCreatedCbs[prop.id][option.name] === 'undefined') {
            optCreatedCbs[prop.id][option.name] = [];
            console.info('CREATE', prop.name, option.name);
            bynder.post({
                uri: 'v4/metaproperties/' + prop.id + '/options/',
                form: {
                    data: JSON.stringify({
                        name: option.name,
                        label: option.label
                    })
                }
            }, function (err, data, res) {
                console.info(err, data, res.headers);
                /*
                 Here's a tricky part. Bynder does not return the ID
                 in it's response payload. Instead of a 201 CREATED,
                 you receive a 301 Redirect. I chose to parse the location
                 header, instead of following the redirect.
                 */
                var location = res.headers.location;
                if (location) {
                    location = location.substr(0, location.length - 1);
                    option.id = location.substr(location.lastIndexOf('/') + 1);
                    // We add the option to the cached _metaproperties
                    prop.options.push(option);
                    // And here we iterate over the callbacks to inform them the option has been added
                } else {
                    // Todo in case of error, we should retry and keep the callbacks awaken. Or throw an Error.
                    console.error('no location header found');
                    console.info(data);
                }
                release();
            });
        }
        optCreatedCbs[prop.id][option.name].push(cb);
    };

    /**
     * Creates an dictionary of metaproperties IDs and options IDs
     * from a dictionary of metaproperties names and options names.
     * If no option is found with the given name, it is created.
     *
     * @param values Object {MetapropertyName: OptionName, ...}
     * @param cb Function {XXXX-XX-XXXXX: XXXX-XXXX-XXXXX, ...}
     */
    var createFromValues = function (values, cb) {
        var target = {};
        getAll(function (metaproperties) {
            async.forEachOfSeries(values, function (value, propName, valueCb) {

                if (typeof metaproperties[propName] === 'undefined') {
                    return valueCb();
                }

                var meta = metaproperties[propName];
                if (meta.type === 'select') {

                    var optionExists = false;

                    meta.options.forEach(function (opt) {
                        // Specific hack. Names like '01' have been imported in Bynder like integers.
                        // I had to check for the numeric values to make it work.
                        if (opt.name === value.name || (!isNaN(parseInt(value.name)) && parseInt(value.name) === parseInt(opt.name))) {
                            target[meta.id] = opt.id;
                            optionExists = true;
                        }
                    });

                    if (optionExists) {
                        return valueCb();
                    }

                    createOption(meta, value, function (optionId) {
                        target[meta.id] = optionId;
                        valueCb();
                    });
                } else {
                    target[metaproperties[propName].id] = value;
                    valueCb();
                }
            }, function () {
                cb(target);
            });
        });
    };

    return {
        getAll: getAll,
        createFromValues: createFromValues,
        createOption: createOption
    }
};
var bynder = require('../src/bynderClient')(require('../credentials'));
var async = require('async');
var metaNames = process.argv.slice(2);

bynder.get('v4/metaproperties/', function (err, metaproperties) {
    metaNames.forEach(function (name) {
        if(typeof metaproperties[name] === 'undefined'){
            return;
        }
        async.forEachLimit(metaproperties[name].options, 20, function (option, cb) {
            var uri = 'v4/metaproperties/' + metaproperties[name].id + '/options/' + option.id + '/';
            bynder.delete(uri, function (err, body, res) {
                cb();
            });
        }, function () {
            console.info('options deleted for', name);
        });
    })
});

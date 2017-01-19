var bynder = require('./src/bynderClient')(require('./credentials'));
var metaproperties = require('./src/metaproperties')(bynder);
var fs = require('fs');
var csv = require('csv-parser');
var async = require('async');
var util = require('util');
var dump = function () {
    for (var i = 0; i < arguments.length; i++) {
        process.stdout.write(util.inspect(arguments[i], {showHidden: false, depth: 32, colors: true}));
        process.stdout.write('\t');
    }
    process.stdout.write('\n');
};

function getTranslations(filename, cb) {
    var values = [];
    fs.createReadStream(filename)
        .pipe(csv({separator: '\t', headers: ['name', 'value']}))
        .on('data', function (row) {
            values.push(row);
        }).on('end', function () {
        cb(values);
    });
}

var nameMatch = function (a, b) {
    return (a.name === b.name || (!isNaN(parseInt(a.name)) && parseInt(a.name) === parseInt(b.name)));
};

function doUpdates(updates, cb) {
    async.eachLimit(updates, 10, function (update, updateCb) {
        var formData = {
            data: JSON.stringify({
                label: update.labels.fr_FR,
                labels: update.labels,
                isSelectable: true
            })
        };

        var params = {
            uri: 'v4/metaproperties/' + update.metapropertyId + '/options/' + update.optionId + '/',
            form: formData
        };

        bynder.post(params, function (err, result) {
            if (result.statuscode !== 201) {
                console.error(formData);
            }
            updateCb();
        })
    }, cb);
}

function translate(metapropertyName, filename, locale) {

    return function (cb) {
        getTranslations(filename, function (translations) {
            var updates = [];
            metaproperties.getAll(function (all) {
                translations.forEach(function (translation) {
                    all[metapropertyName].options.forEach(function (option) {
                        if (nameMatch(translation, option)) {
                            var newValue = {};
                            newValue['fr_FR'] = option.displayLabel; // to remove
                            newValue[locale] = translation.value;
                            updates.push({
                                metapropertyId: all[metapropertyName].id,
                                metapropertyName: metapropertyName,
                                optionId: option.id,
                                optionName: option.name,
                                labels: Object.assign({}, option.labels, newValue)
                            });
                        }
                    });
                });
                doUpdates(updates, cb);
            });
        });
    }
}

async.series([
    translate('S_SubDomain', __dirname + '/data/subdomain_en.csv', 'en_US'),
    translate('S_ShapeGroup', __dirname + '/data/shapegroup_en.csv', 'en_US'),
    translate('S_Shape', __dirname + '/data/shape_en.csv', 'en_US')
], function () {
    console.info('done');
});
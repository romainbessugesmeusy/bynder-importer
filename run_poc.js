var async = require('async');
var clear = require('clear');
var CliTable = require('cli-table');

var fileStats = {};
var bynder = require('./src/bynderClient')(require('./credentials'));
var mapper = require('./src/mapper')(bynder);
var watcher = require('./src/watcher')(bynder, fileStats);
var uploader = require('./src/uploader')(bynder, fileStats);
var saveNewMedia = require('./src/saveNewMedia')(bynder);
var Metaproperties = require('./src/metaproperties')(bynder);
var parsePath = require('./src/parsePath');
var filesize = require('filesize');

var mediasCount = 0;
var limit = 10;
var offset = 1;

var writeStats = function () {
    clear();
    var stats = new CliTable({
        head: ['file', 'size', 'parts', 'status'],
        colWidths: [20, 15, 80, 20]
    });

    for (var filename in fileStats) {
        if (fileStats.hasOwnProperty(filename)) {
            var parts = fileStats[filename].parts || [];
            stats.push([
                parsePath(filename).filename,
                filesize(fileStats[filename].size || 0),
                parts.map(function (part) {
                    return '[' + part + ']'
                }).join(' '),
                fileStats[filename].status || ''
            ]);
        }
    }

    process.stdout.write(stats.toString() + '\n');
};


watcher.onStat(writeStats);
uploader.onStat(writeStats);


mapper({
    mediasPath: __dirname + '/medias/*.tif',
    csvFile: __dirname + '/data/numjob_c&s.csv',
    xmlFile: __dirname + '/data/PH_ECOMM_160526143029000.xml'
}, function (map) {

    function mergeProductsMetaproperties(products) {
        if (products.length === 0) {
            console.info('no products, skipping');
            return {};
        }
        if (products.length === 1) {
            return map.products[products[0]] || {};
        }
        var metaproperties = {};
        products.forEach(function (productId) {
            for (var prop in map.products[productId]) {
                if (map.products[productId].hasOwnProperty(prop)) {
                    if (typeof metaproperties[prop] === 'undefined') {
                        metaproperties[prop] = [];
                    }
                    metaproperties[prop].push(map.products[productId][prop]);
                }
            }
        });

        return metaproperties;
    }


    async.forEachOfLimit(map.medias, 10, function (media, key, eachMediaCb) {
        mediasCount++;
        if (mediasCount <= offset || mediasCount > offset + limit) {
            return eachMediaCb();
        }

        fileStats[media.filename] = {};

        uploader(media.filename, function (finalizeData) {
            watcher.watch(finalizeData.importId, media.filename, function () {
                var metaproperties = mergeProductsMetaproperties(media.products);
                // TODO replace with Metaproperties.createFromValues
                if (key.substr(-3) === '_3D') {
                    metaproperties['B0CE1529-90F0-445A-9961BF5343FBCB08'] = '4CF7D344-E13E-4A37-82E9B7CBB74FFEC0';
                } else {
                    metaproperties['B0CE1529-90F0-445A-9961BF5343FBCB08'] = '99A1B0F0-D868-4FCF-893E8D5E6B1EBF79';
                }

                // Marque C&S
                metaproperties['B060A65563-A252-4B3D-BECD758B48206A6C'] = 'B5834EAB-58D9-4CE1-96AF9FECFB95F58C';
                metaproperties['95D93B51-7DFD-431E-9532275C87F49F21'] = 'C219A23B-C741-4BCA-A19353CFA3D32E3D';

                saveNewMedia(finalizeData.importId, {name: key}, metaproperties, function () {
                    fileStats[media.filename].status = key;
                    writeStats();
                    setTimeout(function () {
                        delete fileStats[media.filename];
                        writeStats();
                    }, 1000 * 10);
                    eachMediaCb();
                });
            }, function () {
                fileStats[media.filename].status = 'ERROR Polling';
                eachMediaCb();
            });
        }, function () {
            fileStats[media.filename].status = 'ERROR';
            eachMediaCb();
        });
    }, function () {
        console.info('\nall done');
    });
});


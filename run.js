var MAX_PARALLEL_UPLOADS = 20;
var SLEEP = 5;
var LIMIT = 10;

var async = require('async');
var fileStats = {};
var fs = require('fs');
var touch = require('touch');
var csv = require('csv-parser');
var bynder = require('./src/bynderClient')(require('./credentials'));
var watcher = require('./src/watcher')(bynder, fileStats);
var uploader = require('./src/uploader')(bynder, fileStats);
var saveNewMedia = require('./src/saveNewMedia')(bynder);
var Metaproperties = require('./src/metaproperties')(bynder);

// var stats = require('./src/stats');
// var writeStats = stats(watcher, uploader);

var csvOptions = {
    separator: ',',
    quote: '"',
    escape: '\\',
    headers: [
        'job',
        'filename',
        'sku',
        'by_activity',
        'by_media_status',
        'by_media_use',
        'by_media_nature',
        'description',
        'by_media_owner'
    ]
};

function parseCSV(path, options, cb) {
    var jobs = [];
    path = path || './data/import_bynder.csv';
    fs.createReadStream(path)
        .pipe(csv(options))
        .on('data', function (row) {
            jobs.push(row);
        })
        .on('end', function () {
            cb(jobs);
        });
}
var errored = fs.createWriteStream('./error.log', {flags: 'a'});
function error(step, job, cb) {
    return function (err) {
        errored.write(job + ';' + step + ';' + err + '\n', 'utf8', cb);
    }
}

var uploaded = fs.createWriteStream('./success.log', {flags: 'a'});
var succeeded = 0;
function success(job, cb) {
    return function () {
        setTimeout(function () {
            uploaded.write(job + '\n', 'utf8', cb);
            succeeded++;
            if (succeeded > LIMIT) {
                complete();
            }
        }, SLEEP * 1000);
    }
}

function complete() {
    process.exit();
}

/**
 * @name Row
 * @type {Object}
 * @property job {String}
 * @property filename {String}
 * @property sku {String}
 * @property description {String}
 * @property by_activity {String}
 * @property by_media_use {String}
 * @property by_media_status {String}
 * @property by_media_nature {String}
 * @property by_media_owner {String}
 *
 */
touch.sync('./success.log');
var successJobs = fs.readFileSync('./success.log', 'utf8');

/**
 *
 * @param {Row} row
 * @param cb
 */
function eachRow(row, cb) {

    // si besoin, modification du nom de fichier
    // row.filename = './medias/' + row.job + '.tif';

    if (successJobs.indexOf(row.job) !== -1) {
        console.info('already uploaded', row.job);
        return cb();
    }

    uploader(row.filename, function (finalizeData) {
        watcher.watch(finalizeData.importId, row.filename, function () {
            Metaproperties.createFromValues({
                sku: row.sku,
                by_activity: {name: row.by_activity},
                by_media_status: {name: row.by_media_status},
                by_media_use: {name: row.by_media_use},
                by_media_nature: row.by_media_nature,
                by_media_owner: {name: row.by_media_owner}
            }, function (metaproperties) {
                console.info(metaproperties);
                saveNewMedia(
                    finalizeData.importId,
                    {name: row.job, description: row.description},
                    metaproperties,
                    success(row.job, cb)
                );
            })
        }, error('watch', row.job, cb))
    }, error('upload', row.job, cb));
}

function run() {
    parseCSV(process.argv[2], csvOptions, function (rows) {
        async.eachLimit(rows, MAX_PARALLEL_UPLOADS, eachRow, complete);
    });
}

run();
var fileStats = {};
var clear = require('clear');
var CliTable = require('cli-table');
var parsePath = require('./parsePath');
var filesize = require('filesize');

module.exports = function (watcher, uploader, fileStats) {

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
    return writeStats;
};

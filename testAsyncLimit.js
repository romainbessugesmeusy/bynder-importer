var async = require('async');
var testArray = [];

for (var i = 0; i < 100; i++) {
    testArray.push(i);
}

async.forEachLimit(testArray, 20, function (item, cb) {
    console.info('processing', item);
    setTimeout(function () {
        console.info('done', item);
        cb();
    }, Math.random() * 300);
}, function () {
    console.info('all done')
});
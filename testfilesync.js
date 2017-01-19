var fs = require('fs');
var shouldBeNull = fs.readFileSync('toto');

console.dir(shouldBeNull);
var bynder = require('./src/bynderClient')(require('./credentials'));
var Metaproperties = require('./src/metaproperties')(bynder);

function run() {
    // Metaproperties.getAll(function(all){
    //     console.info(JSON.stringify(all, null, 2));
    // });

    Metaproperties.createFromValues({
        by_media_use: {name: 'Logo'}
    }, function(meta){
        console.dir(meta);
    })
}

run();
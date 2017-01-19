var unique = require('array-unique');

module.exports = function (bynder) {

    return function (importId, params, metaproperties, cb) {
        var formData = {
            brandId: bynder.brandId,
            importId: importId
        };

        Object.assign(formData, params);

        for (var p in metaproperties) {
            if (metaproperties.hasOwnProperty(p)) {
                if(Array.isArray(metaproperties[p])){
                    var values = unique.immutable(metaproperties[p]);
                    formData['metaproperty.' + p] = values.join(',');
                } else {
                    formData['metaproperty.' + p] = String(metaproperties[p]);
                }
            }
        }

        bynder.post({
            uri: 'v4/media/save/',
            form: formData
        }, cb);
    }
};
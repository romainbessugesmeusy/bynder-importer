var glob = require('glob');
var pathinfo = require('pathinfo');
var csv = require('csv-parser');
var fs = require('fs');
var xmlNodes = require('xml-nodes');
var xmlObjects = require('xml-objects');
var util = require('util');
var async = require('async');


module.exports = function (bynder) {


    var Metaproperties = require('./metaproperties')(bynder);

    /**
     * Iterates through the medias directory and creates an associative object
     * with the uppercase JOB as key
     *
     * @param path
     * @param cb
     */
    function getMediasFiles(path, cb) {
        var medias = {};
        glob(path, function (err, files) {
            files.forEach(function (filename) {
                var infos = pathinfo(filename);
                medias[infos.basename.toUpperCase()] = {
                    filename: filename,
                    products: []
                };
            });
            cb(medias);
        })
    }

    function parseCSV(filename, medias, cb) {

        fs.createReadStream(filename)
            .pipe(csv({separator: ';', quote: '"', escape: '"', headers: ['productId', 'relId', 'jobId']}))
            .on('data', function (row) {
                var productId = row.productId.toUpperCase();

                var jobId = row.jobId.replace('DOSSIER ', '').toUpperCase();

                if (typeof medias[jobId] !== 'undefined' && medias[jobId].products.indexOf(productId) === -1) {
                    medias[jobId].products.push(productId);
                }
            })
            .on('end', cb);
    }


    function parseXML(xmlFile, cb) {

        var products = {};
        var stream = fs.createReadStream(xmlFile);

        stream.pipe(xmlNodes('product'))
            .pipe(xmlObjects({explicitRoot: false, explicitArray: false, mergeAttrs: true}))
            .on('data', function (data) {

                // Pausing the stream allows us to create the metaproperties (cause it's async)
                stream.pause();

                var values = {
                    SKU: data.id,
                    S_Domain: {name: data.hierarchie.univers.id_univers},
                    S_SubDomain: {name: data.hierarchie.sous_univers.id_sous_univers},
                    S_ShapeGroup: {name: data.hierarchie.shape_group.id_shape_group},
                    S_Shape: {name: data.hierarchie.shape.id_shape},
                    P_Material: {name: data.material.id_material},
                    B_Collection: {name: data.collection.id_collection, label: data.collection.label[0]._},
                    B_Thematique: {name: data.thematique.id_thematique, label: data.thematique.label[0]._},
                    P_EAN: data.ean_pce,
                    P_EAN_CB: data.ean_cb
                };

                if (data.capacite) {
                    values.P_Capacity = String(data.capacite) + String(data.cap_unit || '');
                }

                Metaproperties.createFromValues(values, function (obj) {
                    products[data.id] = obj;
                    // Whenever they're created, we resume the parsing
                    stream.resume();
                });
            })
            .on('end', function () {
                // And that's because we wait for the parsing end to quit
                cb(products);
            })
    }

    return function (options, cb) {
        // yeah callback hell... but promise are so overrated nowadays
        console.info('get Media Files');
        getMediasFiles(options.mediasPath, function (medias) {
            console.info('get CSV Files');
            parseCSV(options.csvFile, medias, function () {
                console.info('get XML File');
                parseXML(options.xmlFile, function (products) {
                    cb({
                        products: products,
                        medias: medias
                    });
                });
            });
        });
    }
};
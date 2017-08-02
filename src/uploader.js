var request = require('request');
var parsePath = require('./parsePath');
var fs = require('fs');
var Chunker = require('chunking-streams').SizeChunker;
var temp = require('temp').track();
var filesize = require('filesize');
var emoji = require('node-emoji');
var closestEndpoint;

var CHUNK_SIZE = 5 * 1024 * 1024;


/**
 *
 * @param bynder
 * @param fileStats
 * @return {uploader}
 */
module.exports = function (bynder, fileStats) {

    var statsHandler;

    function retrieveClosestRegionalS3EndpointURL(cb) {
        if (typeof closestEndpoint !== 'undefined') {
            return cb(closestEndpoint);
        }

        bynder.get({uri: 'upload/endpoint'}, function (err, endpoint) {
            closestEndpoint = endpoint || bynder.defaultUploadEndpoint;
            cb(closestEndpoint);
        });
    }

    /**
     * Warning : Bynder does not accept relative paths beginning with '.'
     * Reason : it looks like a Unix hidden file for them
     * @param filename
     * @param cb
     */
    function initializeUpload(filename, cb) {
        setUploadStats(filename, {status: 'initialize'});
        bynder.post({
            uri: 'upload/init',
            form: {filename: parsePath(filename).basename}
        }, function (err, uploadInfos) {
            cb(uploadInfos);
        });
    }

    function registerPart(uploadInfos, key, chunk, completed, chunks, onComplete, onError, retry) {
        retry = (typeof retry === 'undefined') ? true : retry;
        var uploadPath = getUploadPath(uploadInfos);
        var params = {
            targetid: uploadInfos.s3file.targetid,
            filename: key,
            chunkNumber: chunk
        };
        bynder.post({uri: uploadPath, form: params}, function (err, partRegistrationStatus) {

            if (err || partRegistrationStatus.status !== 'ok') {

                setUploadStats(uploadInfos.originalFilename, {
                    part: {
                        chunkNumber: chunk,
                        status: 'ERROR part registration'
                    }
                });

                if (retry) {
                    registerPart(uploadInfos, key, chunk, completed, chunks, onComplete, onError, false);
                } else {
                    return onError('registerPart.' + chunk);
                }
            }
            // todo check for error in registrationStatus
            if (completed === chunks) {
                finalizeUpload(uploadInfos, chunks, onComplete, onError);
            }
        });
    }

    function getUploadPath(uploadInfos) {
        return 'v4/upload/' + uploadInfos.s3file.uploadid + '/';
    }

    function finalizeUpload(uploadInfos, chunks, onComplete, onError) {

        var uploadPath = getUploadPath(uploadInfos);
        var params = {
            targetid: uploadInfos.s3file.targetid,
            s3_filename: uploadInfos.s3_filename,
            chunks: chunks
        };
        bynder.post({uri: uploadPath, form: params}, function (err, finalizeData) {
            if (err || finalizeData.success !== true) {
                setUploadStats(uploadInfos.originalFilename, {status: 'finalize error'});
                return onError('finalize');
            }
            setUploadStats(uploadInfos.originalFilename, {status: 'finalized'});
            onComplete(finalizeData);
        });
    }

    function upload(endpoint, uploadInfos, filename, onComplete, onError) {

        fs.stat(filename, function (err, stats) {

            if (err) {
                setUploadStats(filename, {status: 'ERROR file stat', message: err.message});
                return onError('filestat ' + filename);
            }

            var completed = 0;
            var formData = Object.assign({}, uploadInfos.multipart_params);
            formData.name = parsePath(uploadInfos.s3_filename).basename;
            formData.chunks = Math.ceil(stats.size / CHUNK_SIZE);

            setUploadStats(filename, {size: stats.size, parts: formData.chunks, status: 'UPLOADING parts'});

            var stream = fs.createReadStream(filename);
            var chunker = new Chunker({chunkSize: CHUNK_SIZE, flushTail: true});
            var chunkData;

            uploadInfos.originalFilename = filename;

            chunker.on('chunkStart', function (id, done) {
                chunkData = temp.createWriteStream();
                done();
            });

            chunker.on('chunkEnd', function (id, done) {
                chunkData.end(function () {
                    var chunkNumber = id + 1;
                    /**
                     * For a given S3 filename "test.png" divided in 3 chunks,
                     * this would give test.png/p1, test.png/p2, test.png/p3
                     * @type {string}
                     */
                    var key = uploadInfos.s3_filename + '/p' + chunkNumber;
                    var chunkFormData = Object.assign({}, formData, {
                        chunk: chunkNumber,
                        key: key,
                        Filename: key,
                        file: fs.createReadStream(chunkData.path) // todo check if it doesn't prevent temp file tracking
                    });

                    setUploadStats(filename, {part: {chunkNumber: chunkNumber, status: 'UPLOAD'}});

                    var doUpload = function (retry) {
                        request.post({uri: endpoint, proxy: '', formData: chunkFormData}, function (err, res) {
                            if (err) {
                                setUploadStats(filename, {
                                    part: {
                                        chunkNumber: chunkNumber,
                                        status: 'ERROR',
                                        message: err.message
                                    }
                                });
                                if (retry) {
                                    return doUpload(false);
                                } else {
                                    return onError('chunk.' + chunkNumber);
                                }
                            }

                            if (res.statusCode === 201) {
                                completed++;
                                setUploadStats(filename, {
                                    part: {
                                        chunkNumber: chunkNumber,
                                        status: 'DONE'
                                    }
                                });
                                registerPart(uploadInfos, key, chunkNumber, completed, formData.chunks, onComplete, onError);
                            }
                            done();
                        });
                    };

                    doUpload(true);
                });

            });

            /*
             * Warning if you need to change this. Data event isn't emitted for each chunk, but continuously
             */
            chunker.on('data', function (chunk) {
                chunkData.write(chunk.data);
            });

            chunker.on('end', function () {
                console.info('file read end', filename);
            });

            stream.pipe(chunker);
        });
    }

    function setUploadStats(filename, status) {
        if (!fileStats[filename]) {
            fileStats[filename] = {};
        }

        var stat = fileStats[filename];

        if (status.status) {
            stat.status = status.status;
        }

        if (status.size) {
            stat.size = status.size;
        }

        if (status.parts) {
            stat.parts = new Array(status.parts).fill('WAIT');
        }

        if (status.part) {
            stat.parts[status.part.chunkNumber - 1] = status.part.status;
        }

        if (statsHandler) {
            statsHandler();
        }
    }

    var uploader = function (filename, onComplete, onError) {
        retrieveClosestRegionalS3EndpointURL(function (endpoint) {
            initializeUpload(filename, function (uploadInfos) {
                upload(endpoint, uploadInfos, filename, onComplete, onError);
            });
        });
    };

    uploader.onStat = function (handler) {
        statsHandler = handler;
    };

    return uploader;

};
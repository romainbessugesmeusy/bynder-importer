/**
 * String-based equivalent of PHP's pathinfo()
 * @param p String Path
 * @returns {{dirname: string, filename: string, basename: string, extension: string}}
 */
module.exports = function parsePath(p) {
    p = String(p);

    var lastSepIndex = p.lastIndexOf('/') + 1;
    var lastDotIndex = p.lastIndexOf('.');

    if (lastDotIndex === -1) {
        lastDotIndex = p.length;
    }

    return {
        dirname: p.substr(0, lastSepIndex - 1),
        filename: p.substr(lastSepIndex, lastDotIndex - lastSepIndex),
        basename: p.substr(lastSepIndex),
        extension: p.substr(lastDotIndex + 1)
    }
};
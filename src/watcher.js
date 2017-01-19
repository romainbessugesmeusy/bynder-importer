function ImportWatcher(bynder, fileStats) {
    this.ids = [];
    this.filenames = [];
    this.listeners = {};
    this.isPolling = false;
    this.bynder = bynder;
    this.stats = fileStats;
    this.onStatCb = function () {

    };
    setInterval(function(){
    }, 5000);
}

ImportWatcher.SLEEP = 5000;

ImportWatcher.prototype.poll = function () {
    var self = this;
    self.isPolling = true;
    self.request(function (tryAgain) {
        if (tryAgain) {
            setTimeout(self.poll.bind(self), ImportWatcher.SLEEP);
        } else {
            self.isPolling = false;
        }
    });
};

ImportWatcher.prototype.request = function (cb) {
    if (this.ids.length === 0) {
        return cb(false);
    }

    var self = this;

    this.bynder.get({
        uri: 'v4/upload/poll/',
        qs: {items: this.ids.join(',')}
    }, function (err, data) {
        data.itemsDone.forEach(function (itemDone) {
            var index = self.ids.indexOf(itemDone);
            if (index > -1) {
                self.stats[self.filenames[index]].status = 'polling success';
                self.listeners[itemDone].success();
                self.ids.splice(index, 1);
                self.filenames.splice(index, 1);
                delete self.listeners[itemDone];
            }
        });

        data.itemsFailed.forEach(function (itemFailed) {
            var index = self.ids.indexOf(itemFailed);
            if (index > -1) {
                self.stats[self.filenames[index]].status = 'polling failed';
                self.listeners[itemFailed].error();
                self.ids.splice(index, 1);
                self.filenames.splice(index, 1);
                delete self.listeners[itemFailed];
            }
        });

        self.onStatCb();

        cb(true);
    });
};

ImportWatcher.prototype.onStat = function (cb) {
    this.onStatCb = cb;
};

ImportWatcher.prototype.watch = function (importId, filename, onSuccess, onError) {
    this.ids.push(importId);
    this.filenames.push(filename);
    this.listeners[importId] = {success: onSuccess, error: onError};
    this.stats[filename].status = 'polling';
    this.onStatCb();
    if (!this.isPolling) {
        this.poll();
    }

};

module.exports = function (bynder, fileStats) {
    return new ImportWatcher(bynder, fileStats)
};
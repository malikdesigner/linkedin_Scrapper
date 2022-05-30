const elasticsearch = require('@elastic/elasticsearch');
const client = new elasticsearch.Client({
    nodes: ["http://es-social-llistening.mcpsuite.com:80"],
    auth: {
        username: "social-es",
        password: "mcpes@999D"
    },
    keepAlive: true,
    keepAliveMsecs: 1000,
    timeout: 600000,
    requestTimeout: 600000,
    maxSockets: Infinity,
    maxFreeSockets: 256,
    freeSocketKeepAliveTimeout: 60000,
    ignore: [409],
    log: 'info'
});

const bulkIndex = async (records = [], index = undefined) => {
    if (records === null) {
        logger.error("No records to index");
    }
    if (records.length === 0) {
        logger.error("No records to index");
    }
    if (index === undefined) {
        logger.error("index is undefined");
    }
    const bulkBody = [];
    records.forEach(async record => {
        bulkBody.push({
            index: {
                _index: index,
                _type: '_doc'
            }
        });
        bulkBody.push(record);
    });
    return client.bulk({
        body: bulkBody,
        refresh: true,
    });
};
const index = async (record = undefined, index = undefined) => {
    if (record === undefined) {
        logger.error("record is undefined");
    }
    if (index === undefined) {
        logger.error("index is undefined");
    }
    return client.index({
        index: _currentIndex,
        type: '_doc',
        body: record,
        refresh: true,
    });
};

exports.index = index;
exports.bulkIndex = bulkIndex;

const { logger } = require('../../globals');
const { mapTaskExecutionStatus } = require('../util/lookups');

class QlikSenseApp {
    // eslint-disable-next-line no-useless-constructor
    constructor() {
        //
    }

    async init(app, options) {
        if (app.id) {
            this.appId = app.id;
        }
        this.appName = app.name;

        this.appTags = app.tags;
        this.appTagsFriendly = app.tags.map((tag) => tag.name);
        this.appCustomProperties = app.customProperties;
        this.appCustomPropertiesFriendly = app.customProperties.map((cp) => `${cp.definition.name}=${cp.value}`);
    }
}

module.exports = {
    QlikSenseApp,
};

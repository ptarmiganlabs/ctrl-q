const { logger } = require('../../globals');

class QlikSenseApp {
    // eslint-disable-next-line no-useless-constructor
    constructor() {
        //
    }

    async init(app, tmpAppId, options) {
        if (app.id) {
            this.appId = app.id;
        }
        this.appName = app.name;

        if (tmpAppId) {
            this.tmpAppId = tmpAppId;
        }

        this.appTags = app.tags;
        this.appTagsFriendly = app.tags.map((tag) => tag.name);
        this.appCustomProperties = app.customProperties;
        this.appCustomPropertiesFriendly = app.customProperties.map((cp) => `${cp.definition.name}=${cp.value}`);

        this.appComplete = { ...app };
    }
}

module.exports = {
    QlikSenseApp,
};

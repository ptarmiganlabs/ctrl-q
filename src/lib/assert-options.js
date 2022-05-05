const { logger } = require('../globals');

const sharedParamAssertOptions = (options) => {
    // Ensure that parameters common to all commands are valid
    if (options.authType === undefined || !options.authType) {
        logger.error('Mandatory option --auth-type is missing. Use it to specify how authorization with Qlik Sense will be done.');
        process.exit(1);
    }

    if (options.colRefBy === undefined || !options.colRefBy) {
        logger.error(
            'Mandatory option --col-ref-by is missing. Use it to specify how Excel file columns are referenced (by name or position)'
        );
        process.exit(1);
    }
};

const masterItemImportAssertOptions = (options) => {
    //
};

module.exports = {
    sharedParamAssertOptions,
    masterItemImportAssertOptions,
};

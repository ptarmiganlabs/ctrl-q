/**
 * Manual mock for node:sea module
 * Used for Jest testing environments
 */

const sea = {
    isSea: () => false,
    getAsset: () => {
        throw new Error('Cannot get assets in test environment - not running as SEA');
    },
    getRawAsset: () => {
        throw new Error('Cannot get raw assets in test environment - not running as SEA');
    },
    getAssetAsBlob: () => {
        throw new Error('Cannot get asset as blob in test environment - not running as SEA');
    },
    getAssetKeys: () => [],
};

export default sea;

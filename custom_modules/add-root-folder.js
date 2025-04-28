module.exports = function(url=''){
    const path = require('path');
    const fileLocation = path.dirname(Object.keys(require.cache)[0]);
    const testMode = !fileLocation.match(/www/) && !fileLocation.match(/pm2/); ///process.env.NODE_ENV !== 'production';

    const rootFolder = testMode ? '' : '/td';
    return `${rootFolder}${url}`;
}
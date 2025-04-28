const addRootFolder = require('./add-root-folder');
const testMode = !addRootFolder();//process.env.NODE_ENV !== 'production';
module.exports = testMode;
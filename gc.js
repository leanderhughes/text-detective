try {
    if (global.gc) {
        global.gc();
        console.log('did gc');
    }
    else{
        console.log('no gc');
    }
} catch (e) {
    console.log("`node --expose-gc index.js`");
    process.exit();
}
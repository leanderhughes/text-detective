const addRootFolder = require('../custom_modules/add-root-folder');
module.exports = {
    ensureAuthenticated:function(req,res,next){
        if(!req.isAuthenticated()){
            req.flash('error_msg','Please log in.');
            res.redirect(addRootFolder('/users/login'));
            return;
        }
        next();
    }
}
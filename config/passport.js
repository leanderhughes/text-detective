const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcrypt');

const User = require('../models/User');

module.exports = function(passport) {
    passport.use(
      new LocalStrategy({ usernameField: 'email' }, async(email, password, done) => {
        try {
            const user = await User.findOne({email});
            if(!user){
                return done(null, false, { message: 'That email is not registered' });
            }
            const validated = await bcrypt.compare(password, user.password);
            if(!validated){
                return done(null, false, { message: 'Password incorrect' });
            }
            return done(null,user);
        }
        catch(e){
            return done(e);
        }
      })
    );
  
    passport.serializeUser(function(user, done) {
      done(null, user.id);
    });
  
    passport.deserializeUser(function(id, done) {
      User.findById(id, function(err, user) {
        done(err, user);
      });
    });
  };
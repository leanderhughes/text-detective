const mongoose = require('mongoose');

const SettingsSchema = new mongoose.Schema({
   settingNumber:{
       type:Number,
       default:1
   },
   experimentalAssignment:{
       type:Array,
       default:['note','chat']
   },
   experimentalSequence:{
       type:Object,
       default:{
           any:['pretest','task','posttest']//
       }
   },
   timeSpanToFinalizeRooms:{
        type:Number,
        default:20*1000
   },
   recommendedFinishingTimes:{
       type:Object,
       default:{
           note:{
               word: .5 * 60 * 1000,
               section: 2 * 60*1000
           },
           item:{
               note: 1 * 60 * 1000,
               chat: 4 * 60 * 1000
           }
       }
   },
   illegalWordExceptions:{
       type:Array,
       default:['there','then','people','about','not','this','that','those','these','I','i','know','have','can','because','could','will','yes','no','ok','okay','yeah','would','could','the','do','a','for','it','they','he','his','hers','him','her','them','their','theirs','you','she','when','where','what','why','how','here','be','on','in','at','to','of','so','and','if','but','also','as']
   }
});

const Settings = mongoose.model('Settings',SettingsSchema);

module.exports = Settings;

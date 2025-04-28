

function cloneData(mongooseOb,deleteId=false,deleteDates=false){
    let ob = {};
    let keys = Object.keys(mongooseOb.schema.paths);
    keys.forEach(k=>{
        ob[k] = mongooseOb[k];
    });
    ob.id = mongooseOb._id;
    ob = JSON.parse(JSON.stringify(ob));
    if(!deleteId){
        return ob;
    }
    delete ob.id;
    delete ob._id;
    if(!deleteDates){
        return ob;
    }
    delete ob.dateCreated;
    delete ob.dateUpdated;
    //delete ob.dateStarted;
    delete ob.createdAt;
    delete ob.updatedAt;
    return ob;
}

module.exports = function(mongooseOb,deleteId,deleteDates){

    return cloneData(mongooseOb,deleteId,deleteDates);

}
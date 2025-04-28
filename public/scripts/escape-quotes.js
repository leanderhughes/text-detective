function escapeQuotes(array){
    return array.map(item=>{
        return typeof item=='string' ? item.replace(/"/g,'\\"') : item;
    });
}
module.exports = escapeQuotes;
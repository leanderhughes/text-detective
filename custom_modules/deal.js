class Deal{
    constructor(){

    }      

    drawFromSetsIntoHands(sets,handCount){
        const hands = [];
        for(let i=0; i<handCount;i++){
            hands.push([]);
        }
        sets.forEach(set=>{
            //set.sort((a,b)=>{return .5 - Math.random();});
            set.sort((a,b)=>{return a.index%2 - b.index%2;});
            let h = 0;
            while(h < handCount && set.length){
                hands[h].push(set.pop());
                h++;
                if(set.length && h==handCount){
                    handCount = 0;
                }
            }
        });
        return hands;
    }

    drawItemsFromSets(itemsDrawnPerSet,sets){
        const drawn = [];
        const sumOfIndexes = sets.reduce((sum,s)=>{
            sum+=s.index;
            return sum;
        },0);
        const meanIndex = sumOfIndexes/sets.length;
        function meanDif(ob){
            return Math.abs(ob.index-meanIndex);
        }
        sets.forEach(set=>{
            //set.sort((a,b)=>{return .5 - Math.random();});
            set.sort((a,b)=>{return meanDif(a) - meanDif(b);});
            drawn.push(set.slice(0,itemsDrawnPerSet));
        });
        return drawn;
    }

    flattenArrayOfSets(arrayOfSets){
        return arrayOfSets.reduce((flattened,set)=>{
            flattened.push(...set);
            return flattened;
        },[]);
    }

    sliceIntoSets(array,setCount){
        const itemsPerSet = Math.floor(array.length/setCount);
        const sets = [];
        for(let i=0,l=array.length;i<l;i+=itemsPerSet){
            sets.push(array.slice(i,i+itemsPerSet));
        }
        if(sets.length > setCount){
            const remainder = sets.pop();
            sets[sets.length-1] = [...sets[sets.length-1],...remainder];
        }
        return sets;
    }

}

module.exports = new Deal();
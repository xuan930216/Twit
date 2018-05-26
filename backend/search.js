var Twit = require('twit'); //this is how import twit package

var config = require('./local.json');

var T = new Twit(config); //this is the object of twit which will help us to call function inside

var params = {
    q : "googleio",
    count : 100
}

T.get('search/tweets', params, searchedData);//get is the function to search teh tweet which three params

function searchedData(err, data, response){
    console.log('data' + JSON.stringify(data));

}
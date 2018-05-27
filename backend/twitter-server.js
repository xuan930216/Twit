const Twitter = require('twitter');
const config = require('./local.json');
const client = new Twitter(config);

const Filter = require('bad-words');
filter = new Filter();

const searchTerms = "googleio,googledevelopers,googlecloud,firebase,machine learning,io17,googleio17";

const request = require('request');

//initialize firebase
const admin = require("firebase-admin");
const serviceAccount = require("./local.json");
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://" + config.project_id + ".firebaseio.com"
});
const db = admin.database();
const tweetRef = db.ref('latest');
const hashtagRef = db.ref('hashtags');
const acceptedWordTypes = ['ADJ']; // Add the parts of speech you'd like to graph to this array ('NOUN', 'VERB', etc.)


//get stream in a callback
client.stream('statuses/filter', {track: searchTerms}, function(stream){
    stream.on('data', function(event){
        if((event.text != undefined) && (event.text.substring(0,2)!= "RT") && (event.text === filter.clean(event.text))){
            callNLApi(event);
            //console.log(event);
        }
    });
    stream.on('error', function(error){
        throw error;
    });
});

//send twitter stream to google natural language api
function callNLApi(tweet){
    const textUrl = "https://language.googleapis.com/v1/documents:annotateText?key=" + config.cloud_api_key;
    let requestBody = {
        "document": {
                "type": "PLAIN_TEXT",
                "content": tweet.text
        },
        "features": {
          "extractSyntax": true,
          "extractEntities": true,
          "extractDocumentSentiment": true
        }
    }

    let options = {
            url: textUrl,
            method: "POST",
            body: requestBody,
            json: true
    }

    //The Sentiment Score varies for each individual sentence.
    //The magnitude shows the intensity or magnitude value of that sentence.
   request(options, function(error, response, body){
       if((!error && response.statusCode === 200) && (body.sentences.length !=0)){
        //    console.log(tweet)
        //save latest user information. tweet information and sentiment analysis result to firebase
        let tweetForFb = {
            id: tweet.id_str,
            text: tweet.text,
            user: tweet.user.screen_name,
            user_time_zone: tweet.user.time_zone,
            user_followers_count: tweet.user.followers_count,
            hashtags: tweet.entities.hashtags,
            tokens: body.tokens,//Represents the smallest syntactic building block of the text.
            score: body.documentSentiment.score,
            magnitude: body.documentSentiment.magnitude,
            entities: body.entities
        };
        tweetRef.set(tweetForFb).then(msg => {
            console.log('save!');
        })
       }
   })

}

//save tags and tokens to firebase
tweetRef.on('value', function(snap){
    if(snap.exists()){
        let tweet = snap.val();
        let tokens = tweet['tokens'];
        let hashtags = tweet['hashtags'];
        for(let token of tokens){
           let word = token.lemma.toLowerCase();
           if((acceptedWordTypes.indexOf(token.partOfSpeech.tag) != -1) && !(word.match(/[^A-Za-z0-9]/g))){
               let posRef = db.ref('tokens/' + token.partOfSpeech.tag);
               incrementCount(posRef, word, 1);
           } 
        }

        if(hashtags){
            for(let hashtag of hashtags){
                let text = hashtag.toLowerCase();
                let hRef = hashtagRef.child(text);
                incrementCount(htRef, 'totalScore', tweet.score);
                incrementCount(htRef, 'numMentions', 1);
            }
        }
    }
})

function incrementCount(ref, child, valToIncrement){
    ref.child(child).transaction(function(data){
        if(data != null){
            data += valToIncrement;
        } else{
            data = 1;
        }
        return data;
    });
}
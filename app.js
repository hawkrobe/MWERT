/*  Copyright (c) 2012 Sven "FuzzYspo0N" Bergström, 2013 Robert XD Hawkins
    
    written by : http://underscorediscovery.com
    written for : http://buildnewgames.com/real-time-multiplayer/
    
    modified for collective behavior experiments on Amazon Mechanical Turk

    MIT Licensed.
*/

var 
    gameport        = 8000,
    app             = require('express')(),
    UUID            = require('node-uuid'),
    server          = require('http').createServer(app),
    sio             = require('socket.io').listen(server),
    verbose         = true;

/* Express server set up. */

//The express server handles passing our content to the browser,
//As well as routing users where they need to go. This example is bare bones
//and will serve any file the user requests from the root of your web server (where you launch the script from)
//so keep this in mind - this is not a production script but a development teaching tool.

//Tell the server to listen for incoming connections
server.listen(gameport);

//Log something so we know that it succeeded.
console.log('\t :: Express :: Listening on port ' + gameport );

/*
  This handler will listen for requests on /*, any file from the root of our server.
  See expressjs documentation for more info on routing. The 'file' param will the string
  of characters after the port number in the URL. If you type:
  
  servername.blah.edu:8000/experiments/username/index.html

  Then 'file' will be bound to '/experiments/username/index.html' and
  you need to translate that into the location of that file on your
  server. 
*/

app.get( '/*' , function( req, res, next ) {

    //This is the current file they have requested
    var file = req.params[0]; 

    //For debugging, we can track what files are requested.
    if(verbose) console.log('\t :: Express :: file requested : ' + file);

    //Send the requesting client the file.
    path = "./";
    res.sendfile(path + file );
}); //app.get *

/* Socket.IO server set up. */

//Express and socket.io can work together to serve the socket.io client files for you.
//This way, when the client requests '/socket.io/' files, socket.io determines what the client needs.
        
//Create a socket.io instance using our express server

//Configure the socket.io connection settings. 
//See http://socket.io/

sio.configure(function (){
    
    sio.set('log level', 0);

    sio.set('authorization', function (handshakeData, callback) {
        callback(null, true); // error first callback style 
    });
});

game_server = require('./game.server.js');

//Socket.io will call this function when a client connects, 
//We check to see if the client supplied a worker id (via redirect from mechanical turk)
//if so, we distinguish them by that, otherwise we assign them one at random
sio.sockets.on('connection', function (client) {
    var hs = client.handshake;
    
    // Recover query string information
    var query = require('url').parse(client.handshake.headers.referer, true).query;
    
    // Pull out the variables we need. Expecting two arguments in the query string
    var id = query.id;
    var condition = query.condition;
    console.log("id is" + id);
    // Check to make sure id was correctly entered
    if (id) {
        console.log('A player with id ' + id
                    + ' connected!');
        client.userid = id;
        client.condition = condition;
        //tell the player they connected, giving them their id
        client.emit('onconnected', { id: client.userid } );
        
        //Pass off to game.server.js code
        game_server.findGame(client);
        
        //Now we want to handle some of the messages that clients will send.
        //They send messages here, and we send them to the game_server to handle.
        client.on('message', function(m) {
            game_server.onMessage(client, m);
        }); //client.on message
        
        //Useful to know when someone connects
        console.log('\t socket.io:: player ' + client.userid + ' connected');
        
        //When this client disconnects, we want to tell the game server
        //about that as well, so it can remove them from the game they are
        //in, and make sure the other player knows that they left and so on.
        client.on('disconnect', function () {
            
            //Useful to know when soomeone disconnects
            if (client.userid)
                console.log('\t socket.io:: client disconnected ' + client.userid + ' ' + client.game.id);
            
            //If the client was in a game, set by game_server.findGame,
            //we can tell the game server to update that game state.
            if(client.userid && client.game && client.game.id) {
                
                //player leaving a game should destroy that game
                game_server.endGame(client.game.id, client.userid);
                
            } //client.game_id
            
        }); //client.on disconnect
        
    } else {
        client.userid = 'none';
        client.send('s.alert');
    }
});

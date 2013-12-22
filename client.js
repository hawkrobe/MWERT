/*  Copyright (c) 2012 Sven "FuzzYspo0N" Bergström, 2013 Robert XD Hawkins
    
    written by : http://underscorediscovery.com
    written for : http://buildnewgames.com/real-time-multiplayer/
    
    modified for collective behavior experiments on Amazon Mechanical Turk

    MIT Licensed.
*/

//A window global for our game root variable.
var game = {};

//When loading, we store references to our
//drawing canvases, and initiate a game instance.
window.onload = function(){
    
    //Create our game client instance.
    game = new game_core();

	//Connect to the socket.io server!
	this.client_connect_to_server();

    //Fetch the viewport
    game.viewport = document.getElementById('viewport');
    
    //Adjust their size
    game.viewport.width = game.world.width;
    game.viewport.height = game.world.height;

    //Fetch the rendering contexts
    game.ctx = game.viewport.getContext('2d');

    //Set the draw style for the font
    game.ctx.font = '11px "Helvetica"';

    //Finally, start the loop
    game.update();

}; //window.onload

client_connect_to_server = function(game) {
    
    //Store a local reference to our connection to the server
    game.socket = io.connect();

    //When we connect, we are not 'connected' until we have a server id
    //and are placed in a game by the server. The server sends us a message for that.
    game.socket.on('connect', function(){
	    game.players.self.state = 'connecting';
	}.bind(game));

    //Sent when we are disconnected (network, server down, etc)
    game.socket.on('disconnect', game.client_ondisconnect.bind(game));
    //Sent each tick of the server simulation. This is our authoritive update
    game.socket.on('onserverupdate', game.client_onserverupdate_recieved.bind(game));
    //Handle when we connect to the server, showing state and storing id's.
    game.socket.on('onconnected', game.client_onconnected.bind(game));
    //On error we just show that we are not connected for now. Can print the data.
    game.socket.on('error', game.client_ondisconnect.bind(game));
    //On message from the server, we parse the commands and send it to the handlers
    game.socket.on('message', game.client_onnetmessage.bind(game));
}; //game_core.client_connect_to_server


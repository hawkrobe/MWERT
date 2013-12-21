/*  Copyright (c) 2012 Sven "FuzzYspo0N" Bergström, 2013 Robert XD Hawkins
    
    written by : http://underscorediscovery.com
    written for : http://buildnewgames.com/real-time-multiplayer/
    
    modified for collective behavior experiments on Amazon Mechanical Turk

    MIT Licensed.
*/

//The main update loop runs on requestAnimationFrame,
//Which falls back to a setTimeout loop on the server
//Code below is from Three.js, and sourced from links below

//http://paulirish.com/2011/requestanimationframe-for-smart-animating/
//http://my.opera.com/emoller/blog/2011/12/20/requestanimationframe-for-smart-er-animating

//requestAnimationFrame polyfill by Erik Möller
//fixes from Paul Irish and Tino Zijdel

// No need to touch this top part, it's what makes the animation work
var frame_time = 60/1000; // run the local game at 16ms/ 60hz
if('undefined' != typeof(global)) frame_time = 45; //on server we run at 45ms, 22hz

( function () {

    var lastTime = 0;
    var vendors = [ 'ms', 'moz', 'webkit', 'o' ];

    for ( var x = 0; x < vendors.length && !window.requestAnimationFrame; ++ x ) {
        window.requestAnimationFrame = window[ vendors[ x ] + 'RequestAnimationFrame' ];
        window.cancelAnimationFrame = window[ vendors[ x ] + 'CancelAnimationFrame' ] || window[ vendors[ x ] + 'CancelRequestAnimationFrame' ];
    }

    if ( !window.requestAnimationFrame ) {
        window.requestAnimationFrame = function ( callback, element ) {
            var currTime = Date.now(), timeToCall = Math.max( 0, frame_time - ( currTime - lastTime ) );
            var id = window.setTimeout( function() { callback( currTime + timeToCall ); }, timeToCall );
            lastTime = currTime + timeToCall;
            return id;
        };
    }

    if ( !window.cancelAnimationFrame ) {
        window.cancelAnimationFrame = function ( id ) { clearTimeout( id ); };
    }
}() );

//The main game class. This gets created on
//both server and client. Server creates one for
//each game that is hosted, and client creates one
//for itself to play the game. When you set a variable,
//remember that it's only set in that instance 

var game_core = function(game_instance){

    //Store the instance, if any (passed from game.server.js)
    this.instance = game_instance;

    //Store a flag if we are the server instance
    this.server = this.instance !== undefined;

    //Store a flag if a newgame has been initiated.
    //Used to prevent the loop from continuing to start newgames during timeout
    this.newgame_initiated_flag = false;

    //Used in collision etc.
    this.world = {
	width : 720,
	height : 480
    };
    
    // Create targets and assign fixed position
    this.cities = {
	top : new city({x : 360, y : 120}),
	bottom : new city({x : 360, y : 360})
    };

    //We create a player set, passing them
    //the game that is running them, as well
    if(this.server) {
	this.players = {
	    self : new game_player(this,this.instance.player_host),
	    other : new game_player(this,this.instance.player_client)
	};
	this.game_clock = 0;
    } else {
	this.players = {
	    self : new game_player(this),
	    other : new game_player(this)
	};
    }
    
    //The speed at which the clients move (e.g. 10px/tick)
    this.global_speed = 10;

    //Set to true if we want players to act under noise
    this.noise = false;

    //How often the players move forward <global_speed>px in ms.
    this.tick_frequency = 666;

    //Number of games left
    this.games_remaining = 50;

    //Players will replay over and over, so we keep track of which number we're on,
    //to print out to data file
    this.game_number = 1;

    //If draw_enabled is true, players will see their true angle. If it's false,
    //players can set their destination and keep it hidden from the other player.
    this.draw_enabled = true;

    //Start a physics loop, this is separate to the rendering
    //as this happens at a fixed frequency. Capture the id so
    //we can shut it down at end.
    this.physics_interval_id = this.create_physics_simulation();
    
    //Client specific initialisation
    if(!this.server) {
            
	//Connect to the socket.io server!
	this.client_connect_to_server();

	this.players.other.color = '#212121';
	this.players.self.color = '#212121';
	
	var local_this = this;
	
	//Assign click handler ONCE, with the associated data.
	$('#viewport').click(function(e){
	    e.preventDefault();
	    // e.pageX is relative to whole page -- we want
	    // relative to GAME WORLD (i.e. viewport)
	    var offset = $(this).offset(); 
	    var relX = e.pageX - offset.left;
	    var relY = e.pageY - offset.top;
	    
	    // The things we care about are not yet defined, so we
	    // just pass it off to another function
	    local_this.client_on_click(relX, relY);
	});
	
    } 

}; //game_core.constructor

//server side we set the 'game_core' class to a global type, so that
//it can use it anywhere.
if( 'undefined' != typeof global ) {
    module.exports = global.game_core = game_core;
}

/*
    Helper functions for the game code

        Here we have some common maths and game related code to make
        working with 2d vectors easy, as well as some helpers for
        rounding numbers to fixed point.

*/

// (4.22208334636).fixed(n) will return fixed point value to n places, default n = 3
Number.prototype.fixed = function(n) { n = n || 3; return parseFloat(this.toFixed(n)); };

game_core.prototype.distance_between = function(obj1, obj2) {
    x1 = obj1.x;
    x2 = obj2.x;
    y1 = obj1.y;
    y2 = obj2.y;
    return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
};

//copies a 2d vector like object from one to another
game_core.prototype.pos = function(a) { return {x:a.x,y:a.y}; };

//Add a 2d vector with another one and return the resulting vector
game_core.prototype.v_add = function(a,b) { return { x:(a.x+b.x).fixed(), y:(a.y+b.y).fixed() }; };

//For the server, we need to cancel the setTimeout that the polyfill creates
game_core.prototype.stop_update = function() {  

    // Stop old game from animating anymore
    window.cancelAnimationFrame( this.updateid );  

    // Stop loop still running from old game (if someone is still left,
    // game_server.endGame will start a new game for them).
    clearInterval(this.physics_interval_id);
};

/*
    The player class
        A simple class to maintain state of a player on screen,
        as well as to draw that state when required.
*/

var game_player = function( game_instance, player_instance ) {

    //Store the instance, if any
    this.instance = player_instance;
    this.game = game_instance;
    
    //Set up initial values for our state information
    this.size = { x:16, y:16, hx:8, hy:8 };
    this.state = 'not-connected';
    this.message = '';
    
    this.info_color = 'rgba(255,255,255,0)';
    this.id = '';
    this.cities_enabled = false;
    this.destination = null;
    this.points_earned = 0;
    this.speed = 0;
    this.curr_distance_moved = 0;

    //These are used in moving us around later
    this.old_state = {pos:{x:0,y:0}};
    this.cur_state = {pos:{x:0,y:0}};

    //The world bounds we are confined to
    this.pos_limits = {
	x_min: this.size.hx,
	x_max: this.game.world.width - this.size.hx,
	y_min: this.size.hy,
	y_max: this.game.world.height - this.size.hy
    };

    this.distanceFrom = function(other_object_location) {
	x1 = this.pos.x;
	x2 = other_object_location.x;
	y1 = this.pos.y;
	y2 = other_object_location.y;
	return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
    }

    //The 'host' of a game gets created with a player instance since
    //the server already knows who they are. If the server starts a game
    //with only a host, the other player is set up in the 'else' below
    if(player_instance) {
	this.pos = { x:180, y:240 };
	this.color = '#2288cc';  // COLOR OF host
	this.angle = 90;
	// start_angle is a way to prevent players from revealing true angle
	// during countdown...
	this.start_angle = 90;
    } else {
	this.pos = { x:540, y:240 };
	this.color = '#CD0000'; // COLOR of client
	this.angle = 90;
	this.start_angle = 90;
    }    
}; //game_player.constructor

// A city (aka target) is an object with some properties
var city = function(location) {
    this.payoff = 1;
    this.location = location;
    this.visited = false;
    this.radius = 10;
    this.outer_radius = this.radius + 35;
    this.color = 'white';
};

// Draw players as triangles using HTML5 canvas
game_player.prototype.draw = function(){
    game.ctx.font = "10pt Helvetica";

    // Draw avatar as triangle
    var v = [[0,-8],[-5,8],[5,8]];
    game.ctx.save();
    game.ctx.translate(this.pos.x, this.pos.y);
    // draw_enabled is set to false during the countdown, so that
    // players can set their destinations but won't turn to face them.
    // As soon as the countdown is over, it's set to true and they
    // immediately start using that new angle
    if (this.game.draw_enabled) {
	game.ctx.rotate((this.angle * Math.PI) / 180);
    } else {
	game.ctx.rotate((this.start_angle * Math.PI) / 180);
    }
    // This draws the triangle
    game.ctx.fillStyle = this.color;
    game.ctx.strokeStyle = this.color;
    game.ctx.beginPath();
    game.ctx.moveTo(v[0][0],v[0][1]);
    game.ctx.lineTo(v[1][0],v[1][1]);
    game.ctx.lineTo(v[2][0],v[2][1]);
    game.ctx.closePath();
    game.ctx.stroke();
    game.ctx.fill();

    game.ctx.beginPath();
    game.ctx.restore();
    
    // Draw destination as an 'x' if it exists
    if (this.destination) {
	game.ctx.strokeStyle = this.color;
	game.ctx.beginPath();
	game.ctx.moveTo(this.destination.x - 5, this.destination.y - 5);
	game.ctx.lineTo(this.destination.x + 5, this.destination.y + 5);

	game.ctx.moveTo(this.destination.x + 5, this.destination.y - 5);
	game.ctx.lineTo(this.destination.x - 5, this.destination.y + 5);
	game.ctx.stroke();
    }

    //Draw tag underneath players
    game.ctx.fillStyle = this.info_color;
    game.ctx.fillText(this.state, this.pos.x+10, this.pos.y + 20); 

    // Draw message in center (for countdown, e.g.)
    game.ctx.fillStyle = 'white';
    game.ctx.fillText(this.message, 290, 240);

    // Represent speeds in corner as a sort of bar graph (to visualize the effect of noise)
    game.ctx.fillText("Your current speed: ", 5, 15);
    game.ctx.fillText("Other's current speed: ", 5, 40);
    game.ctx.beginPath();
    game.ctx.strokeStyle = 'rgba(255,255,255,0.1)';

    // Light gray vertical line as base
    game.ctx.moveTo(145, 0);
    game.ctx.lineTo(145, 45);
    game.ctx.stroke();

    // Self line for speed counter
    game.ctx.beginPath();
    game.ctx.moveTo(145, 12);
    if (this.game.players.self.curr_distance_moved == 0) {
	game.ctx.strokeStyle = 'rgba(255,255,255,0.1)';
	game.ctx.lineTo(145 + 30, 12);
	game.ctx.stroke();
    } else {
	game.ctx.lineWidth = 15;
	game.ctx.strokeStyle = 'white';
	game.ctx.lineTo(145 + 3*this.game.players.self.curr_distance_moved.toFixed(2), 12);
	game.ctx.stroke();
	game.ctx.lineWidth = 1;
    }

    // Other line...
    game.ctx.beginPath();
    game.ctx.moveTo(145, 37);
    if(this.game.players.other.curr_distance_moved == 0) {
	game.ctx.strokeStyle = 'rgba(255,255,255,0.1)';
	game.ctx.lineTo(145 + 30, 37);
	game.ctx.stroke();
    } else {
	game.ctx.lineWidth = 15;
	game.ctx.strokeStyle = 'white';
	game.ctx.lineTo(145 + 3*this.game.players.other.curr_distance_moved.toFixed(2), 37);
	game.ctx.stroke();
	game.ctx.lineWidth = 1;
    }
    game.ctx.stroke();

}; //game_player.draw

// this.cities_enabled is set to true when both people have joined.
// Uses HTML5 canvas

game_player.prototype.draw_cities = function() {
    // Draw cities
    if (this.cities_enabled) {
	var centerX1 = this.game.cities.top.location.x;
	var centerY1 = this.game.cities.top.location.y;
	var centerX2 = this.game.cities.bottom.location.x;
	var centerY2 = this.game.cities.bottom.location.y;
	var radius = this.game.cities.top.radius;
	var outer_radius = this.game.cities.top.outer_radius;

	// Filled in top city
	game.ctx.beginPath();
	game.ctx.arc(centerX1, centerY1, radius, 0, 2 * Math.PI, false);
	game.ctx.fillStyle = this.game.cities.top.color;	
	game.ctx.fill();
	game.ctx.lineWidth = 1;
	game.ctx.strokeStyle = 'gray';
	game.ctx.stroke();

	// Outer line around top city
	game.ctx.beginPath();
	game.ctx.arc(centerX1, centerY1, outer_radius, 0, 2 * Math.PI, false);
	game.ctx.stroke();
	
	// Filled in bottom city
	game.ctx.beginPath();
	game.ctx.arc(centerX2, centerY2, radius, 0, 2 * Math.PI, false);
	game.ctx.fillStyle = this.game.cities.bottom.color;
	game.ctx.fill();
	game.ctx.stroke();

	// Outer line around bottom city
	game.ctx.beginPath();
	game.ctx.arc(centerX2, centerY2, outer_radius, 0, 2 * Math.PI, false);
	game.ctx.stroke();
	
	// Draw tag next to cities (for payoff info)
	game.ctx.fillStyle = 'white';
	game.ctx.font = "15pt Helvetica";
	cities = this.game.cities;
	game.ctx.fillText("$0.0" + cities.top.payoff, cities.top.location.x - 27, cities.top.location.y - 50 );
	game.ctx.fillText("$0.0" + cities.bottom.payoff, cities.bottom.location.x - 27, cities.bottom.location.y + 65);
    }
}; // draw_cities

/*

 Common functions
 
    These functions are shared between client and server, and are generic
    for the game state. The client functions are client_* and server functions
    are server_* so these have no prefix.

*/

//Main update loop -- don't worry about it
game_core.prototype.update = function() {
    
    //Update the game specifics
    if(!this.server) 
        this.client_update();
    else 
        this.server_update();

    //schedule the next update
    this.updateid = window.requestAnimationFrame( this.update.bind(this), this.viewport );
}; //game_core.update

/*
    Shared between server and client.
    Prevents people from leaving the arena
*/

game_core.prototype.check_collision = function( item ) {
    //Left wall.
    if(item.pos.x <= item.pos_limits.x_min)
        item.pos.x = item.pos_limits.x_min;
 
    //Right wall
    if(item.pos.x >= item.pos_limits.x_max )
        item.pos.x = item.pos_limits.x_max;
       
    //Roof wall.
    if(item.pos.y <= item.pos_limits.y_min) 
        item.pos.y = item.pos_limits.y_min;
    
    //Floor wall
    if(item.pos.y >= item.pos_limits.y_max ) 
        item.pos.y = item.pos_limits.y_max;

    //Fixed point helps be more deterministic
    item.pos.x = item.pos.x.fixed(4);
    item.pos.y = item.pos.y.fixed(4);
}; //game_core.check_collision

game_core.prototype.update_physics = function() {
    if(this.server) 
	this.server_update_physics();
}; //game_core.prototype.update_physics

/*

 Server side functions
 
    These functions below are specific to the server side only,
    and usually start with server_* to make things clearer.

*/

// This is called every 1000ms and simulates the world state. This is where we
// update positions based on noise and angle and check whether cities
// have been reached.
game_core.prototype.server_update_physics = function() {

    host_player = this.players.self;
    other_player = this.players.other;
    top_city = this.cities.top;
    bottom_city = this.cities.bottom;

    // If a player has reached their destination, stop Have to put
    // other wrapper because destination is null until player clicks
    // Must use distance from, since the player's position is at the
    // center of the body, which is long. As long as any part of the
    // body is where it should be, we want them to stop.
    if (host_player.destination) {
	if (host_player.distanceFrom(host_player.destination) < 8)
	    host_player.speed = 0;
    }
    if (other_player.destination) {
	if (other_player.distanceFrom(other_player.destination) < 8)
	    other_player.speed = 0;
    }

    // Impose Gaussian noise on movement to create uncertainty
    // Recall base speed is 10, so to avoid moving backward, need that to be rare.
    // Set the standard deviation of the noise distribution.
    if (this.noise) {
	var noise_sd = 4;
	var nd = new NormalDistribution(noise_sd,0); 
	
	// If a player isn't moving, no noise. Otherwise they'll wiggle in place.
	// Use !good2write as a proxy for the 'waiting room' state
	if (host_player.speed == 0 || !this.good2write) 
	    host_player.noise = 0;
	else
	    host_player.noise = nd.sample();
	
	if (other_player.speed == 0 || !this.good2write)
	    other_player.noise = 0;
	else 
	    other_player.noise = nd.sample();
    } else {
	host_player.noise = 0;
	other_player.noise = 0;
    }

    //Handle player one movement (calculate using polar coordinates)
    r1 = host_player.curr_distance_moved = host_player.speed + host_player.noise;
    theta1 = (host_player.angle - 90) * Math.PI / 180;
    host_player.old_state.pos = this.pos( host_player.pos );
    var new_dir = {x : r1 * Math.cos(theta1), 
		   y : r1 * Math.sin(theta1)};  
    host_player.pos = this.v_add( host_player.old_state.pos, new_dir );

    //Handle player two movement
    r2 = other_player.curr_distance_moved = other_player.speed + other_player.noise;
    theta2 = (other_player.angle - 90) * Math.PI / 180;    
    other_player.old_state.pos = this.pos( other_player.pos );
    var other_new_dir = {x : r2 * Math.cos(theta2), 
			 y : r2 * Math.sin(theta2)};  
    other_player.pos = this.v_add( other_player.old_state.pos, other_new_dir);    

    //Keep the players in the world
    this.check_collision( host_player );
    this.check_collision( other_player );

    // Check whether either plays has reached a city
    // Make sure this can't happen before both players have connected
    if (this.good2write) {
	this.server_check_for_payoff(host_player, other_player, 'host');
	this.server_check_for_payoff(other_player, host_player, 'other');
    }
    
    // For ballistic version, if game hasn't started yet, check whether destinations
    // are valid. If so, start game!    
    var condition1 = false;
    var condition2 = false;
    if (!this.good2write && this.instance.player_client && this.condition == 'ballistic') {
	if (host_player.destination) {
	    condition1 = (this.distance_between(host_player.destination, 
						top_city.location) < 10 ||
			  this.distance_between(host_player.destination, 
						bottom_city.location) < 10);
	}
	if (other_player.destination) {
	    condition2 = (this.distance_between(other_player.destination, 
						top_city.location) < 10 ||
			  this.distance_between(other_player.destination, 
						bottom_city.location) < 10);
	}
	// define some situations once destinations have been set
	if (condition1 && condition2) {
	    this.instance.player_host.send('s.m.               GO!');
	    this.instance.player_client.send('s.m.               GO!');
	    this.good2write = true;
	    this.draw_enabled = true;
	    this.players.self.speed = this.global_speed;
	    this.players.other.speed = this.global_speed;
	    this.game_clock = 0;
	} else if (condition1 && !condition2) {
	    this.instance.player_host.send('s.p. Waiting for other player');
	    this.instance.player_client.send('s.p.      Choose a target.');
	} else if (!condition1 && condition2) {
	    this.instance.player_client.send('s.p. Waiting for other player');
	    this.instance.player_host.send('s.p.      Choose a target.');
	} else if (this.instance.player_client) {
	    this.instance.player_host.send('s.p.      Choose a target');
	    this.instance.player_client.send('s.p.      Choose a target');
	}
    }
}; //game_core.server_update_physics

// A lot of our specific game logic is buried in this function. The dictates when
// players get payoffs (i.e. if they're close, the other player is far, and the
// target hasn't been reached yet). If you want to change the "win" condition, it's here.
game_core.prototype.server_check_for_payoff = function(player1, player2, whoisplayer1){

    // Check whether players have reached 
    var top_city = this.cities.top;
    var bottom_city = this.cities.bottom;
    
    // If player1 reaches the top city before player2, reward them and
    // end the game
    if (player1.distanceFrom(top_city.location) < top_city.radius + 8
	&& !top_city.visited
	&& player2.distanceFrom(top_city.location) > top_city.outer_radius + 8) {
	top_city.visited = true;
	top_city.color = player1.color;
	player1.points_earned += top_city.payoff;
	bottom_city.visited = true;
	bottom_city.color = player2.color;
	player2.points_earned += bottom_city.payoff;
	if (whoisplayer1 == 'host') { 
	    this.instance.player_host.send('s.m.    You earned ' + top_city.payoff + '\xA2');
	    this.instance.player_client.send('s.m.    You earned ' + bottom_city.payoff + '\xA2');
	} else if (whoisplayer1 == 'other') {
	    this.instance.player_host.send('s.m.    You earned ' + bottom_city.payoff + '\xA2');
	    this.instance.player_client.send('s.m.    You earned ' + top_city.payoff + '\xA2');
	}
    // If it's a tie, no one wins and game over (i.e. set both cities to visited)
    } else if(player1.distanceFrom(top_city.location) < top_city.radius + 8
	      && !top_city.visited
	      && player2.distanceFrom(top_city.location) < top_city.outer_radius + 8) {
	// Let them know they tied...
	this.instance.player_client.send('s.m.Tie! No money awarded!');
	this.instance.player_host.send('s.m.Tie! No money awarded!');
	top_city.visited = true;
	bottom_city.visited = true;
	top_city.color = 'black';
    }	

    // Same thing for bottom city
    if (player1.distanceFrom(bottom_city.location) < bottom_city.radius + 8
	&& !bottom_city.visited
	&& player2.distanceFrom(bottom_city.location) > bottom_city.outer_radius + 8) {
	bottom_city.visited = true;
	top_city.visited = true;
	top_city.color = player2.color;
	bottom_city.color = player1.color;
	player1.points_earned += bottom_city.payoff;
	player2.points_earned += top_city.payoff;
	if (whoisplayer1 == 'host') { 
	    this.instance.player_host.send('s.m.     You earned ' + bottom_city.payoff + '\xA2');
	    this.instance.player_client.send('s.m.     You earned ' + top_city.payoff + '\xA2');
	} else if (whoisplayer1 == 'other') {
	    this.instance.player_host.send('s.m.     You earned ' + top_city.payoff + '\xA2');
	    this.instance.player_client.send('s.m.     You earned ' + bottom_city.payoff + '\xA2');
	}
    } else if(player1.distanceFrom(bottom_city.location) < bottom_city.radius + 8
	      && !bottom_city.visited
	      && player2.distanceFrom(bottom_city.location) < bottom_city.outer_radius + 8) {
	// Let them know they tied...
	this.instance.player_client.send('s.m.Tie! No money awarded!');
	this.instance.player_host.send('s.m.Tie! No money awarded!');
	top_city.visited = true;
	bottom_city.visited = true;
	bottom_city.color = 'black';
    }

    // If both cities have been marked as visited, we tell the server
    // we're ready to start a new game. But we only do it once, thus the flag.
    if ((top_city.visited 
	 && bottom_city.visited
	 && !this.newgame_initiated_flag)) {

	console.log("Both cities visited...");
	this.players.self.speed = 0;
	this.players.other.speed = 0;
	this.newgame_initiated_flag = true;
	var local_this = this;

	// Need to wait a second before resetting so players can see what happened
	setTimeout(function(){
		// Keep track of which game we're on
		local_this.game_number += 1;
		local_this.newgame_initiated_flag = false;
		local_this.server_newgame();
	    }, 1500);
    }
}; //game_core.server_check_for_payoff

// Notifies clients of changes on the server side. Server totally
// handles position and points.
game_core.prototype.server_update = function(){

    //Make a snapshot of the current state, for updating the clients
    this.laststate = {
        hpos: this.players.self.pos,                //'host position', the game creators position
        cpos: this.players.other.pos,               //'client position', the person that joined, their position
        hpoi: this.players.self.points_earned,      //'host points'
	cpoi: this.players.other.points_earned,     //'client points'
	hcdm: this.players.self.curr_distance_moved, //'host speed'
	ccdm: this.players.other.curr_distance_moved,//'client speed'
	tcc : this.cities.top.color,                //'top city color'
	bcc : this.cities.bottom.color,             //'bottom city color'
	tcp : this.cities.top.payoff,               //'top city payoff'
	bcp : this.cities.bottom.payoff,            //'bottom city payoff'
	cond: this.condition,                        //dynamic or ballistic?
	de  : this.draw_enabled,                    // true to see angle
	g2w : this.good2write,                      // true when game's started
    };


    //Send the snapshot to the 'host' player
    if(this.players.self.instance) {
        this.players.self.instance.emit( 'onserverupdate', this.laststate );
    }

    //Send the snapshot to the 'client' player
    if(this.players.other.instance) {
        this.players.other.instance.emit( 'onserverupdate', this.laststate );
    }

}; //game_core.server_update

/*

 Client side functions

    These functions below are specific to the client side only,
    and usually start with client_* to make things clearer.

*/

// This function tells the server where the client clicked so
// that their destination and angle can be updated. 
game_core.prototype.client_on_click = function( newX, newY ) {
    // Auto-correcting input, but only between rounds
    if (this.condition == 'ballistic' && !this.draw_enabled) {
	if (this.distance_between({x : newX, y : newY},
				  this.cities.top.location) < this.cities.top.outer_radius) {
	    newX = this.cities.top.location.x;
	    newY = this.cities.top.location.y;
	} else if (this.distance_between({x : newX, y: newY},
					 this.cities.bottom.location) < this.cities.bottom.outer_radius) {
	    newX = this.cities.bottom.location.x;
	    newY = this.cities.bottom.location.y;
	}
    }
    
    oldX = this.players.self.pos.x;
    oldY = this.players.self.pos.y;
    dx = newX - oldX;
    dy = newY - oldY;

    // Complicated logic. If you're in the dynamic condition, your clicks will
    // ALWAYS register. If you're in the ballistic condition, they'll only register
    // if you're in the pre- (or between-)game period where nothing's being written.
    if((this.condition == "ballistic" && !this.good2write) || 
       this.condition == "dynamic") {
	console.log("Woop, your click was received")
	this.players.self.destination = {x : Math.round(newX), y : Math.round(newY)};
	this.players.self.angle = Math.round((Math.atan2(dy,dx) * 180 / Math.PI) + 90);


	// Send this information to server so that other player (and server) 
	// can update information
	info_packet = ("c." + this.players.self.angle + 
		       "."  + this.players.self.destination.x +
		       "."  + this.players.self.destination.y);
	this.socket.send(info_packet);
    } //end the if statement for ballistic condition
}; // client_on_click

// This function is at the center of a difficult problem you have to
// deal with in networking -- everybody has different INSTANCES of the
// game. The server has its own, and both players have theirs
// too. This can get confusing because the server will update a
// variable, and the variable of the same name won't change in the
// clients (because they have a different instance of it). To make
// sure everybody's on the same page, the server regularly sends news
// about its variables to the clients so that they can update their variables
// to reflect changes.
game_core.prototype.client_onserverupdate_recieved = function(data){

    //Lets clarify the information we have locally. One of the players is 'hosting' and
    //the other is a joined in client, so we name these host and client for making sure
    //the positions we get from the server are mapped onto the correct local sprites
    var player_host = this.players.self.host ?  this.players.self : this.players.other;
    var player_client = this.players.self.host ?  this.players.other : this.players.self;
    var this_player = this.players.self;
        
    // Update client versions of variables with data received from server
    if(data.hpos) 
	player_host.pos = this.pos(data.hpos); 
    if(data.cpos) 
	player_client.pos = this.pos(data.cpos);
    
    player_host.points_earned = data.hpoi;
    player_client.points_earned = data.cpoi;
    player_host.curr_distance_moved = data.hcdm;
    player_client.curr_distance_moved = data.ccdm;
    this.cities.top.payoff = data.tcp;
    this.cities.bottom.payoff = data.bcp; 
    this.cities.top.color = data.tcc;
    this.cities.bottom.color = data.bcc;
    this.condition = data.cond;
    this.draw_enabled = data.de;
    this.good2write = data.g2w;

}; //game_core.client_onserverupdate_recieved

game_core.prototype.client_update = function() {
    //Clear the screen area
    this.ctx.clearRect(0,0,720,480);

    //draw help/information if required
    this.client_draw_info("Instructions: Click where you want to go");

    //Draw cities first, so in background
    this.players.self.draw_cities();

    //Draw opponent next
    this.players.other.draw();

    // Draw points scoreboard 
    this.ctx.fillText("Money earned: $" + (this.players.self.points_earned / 100).toFixed(2), 300, 15);
    this.ctx.fillText("Games remaining: " + this.games_remaining, 580, 15)

    //And then we draw ourself so we're always in front
    this.players.self.draw();

}; //game_core.update_client

game_core.prototype.create_physics_simulation = function() {    
    return setInterval(function(){
	    this.update_physics();
	    this.game_clock += 1;
	    if (this.good2write) {
		this.writeData();
	    }
	}.bind(this), this.tick_frequency);
}; //game_core.client_create_physics_simulation

// Every second, we print out a bunch of information to a file in a
// "data" directory. We keep EVERYTHING so that we
// can analyze the data to an arbitrary exactness later on.
game_core.prototype.writeData = function() {
    // Some funny business going on with angles being negative, so we correct for that
    var host_angle_to_write = this.players.self.angle;
    var other_angle_to_write = this.players.other.angle;
    var file_path;
    if (this.players.self.angle < 0)
	host_angle_to_write = parseInt(this.players.self.angle, 10) + 360;
    if (this.players.other.angle < 0)
	other_angle_to_write = parseInt(this.players.other.angle, 10)  + 360;
    if (this.condition == "ballistic") 
	file_path = "data/high_conflict_ballistic/game_" + this.game_id + ".csv";
    else if (this.condition == "dynamic") 
	file_path = "data/high_conflict_dynamic/game_" + this.game_id + ".csv";
    // Write data for the host player
    var host_data_line = String(this.game_number) + ',';
    host_data_line += String(this.game_clock) + ',';
    host_data_line += this.best_city_string + ',';
    host_data_line += "host,";
    host_data_line += this.players.self.pos.x + ',';
    host_data_line += this.players.self.pos.y + ',';
    host_data_line += host_angle_to_write + ',';
    host_data_line += this.players.self.points_earned + ',';
    host_data_line += this.players.self.noise.toFixed(2) + ',';
    this.fs.appendFile(file_path, 
		       String(host_data_line) + "\n",
		       function (err) {
			   if(err) throw err;
		       });
    console.log("Wrote: " + host_data_line);

    // Write data for the other player
    var other_data_line = String(this.game_number) + ',';
    other_data_line += String(this.game_clock) + ',';
    other_data_line += this.best_city_string + ',';
    other_data_line += "other,";
    other_data_line += this.players.other.pos.x + ',';
    other_data_line += this.players.other.pos.y + ',';
    other_data_line += other_angle_to_write + ',';
    other_data_line += this.players.other.points_earned + ',';
    other_data_line += this.players.other.noise.toFixed(2) + ',';
    this.fs.appendFile(file_path,
		       String(other_data_line) + "\n",
		       function (err) {
			   if(err) throw err;
		       });
    console.log("Wrote: " + other_data_line);
};

// This gets called every iteration of a new game to reset positions
game_core.prototype.server_reset_positions = function() {

    var player_host = this.players.self.host ?  this.players.self : this.players.other;
    var player_client = this.players.self.host ?  this.players.other : this.players.self;

    player_host.pos = {x : 540, y:240};
    player_client.pos = {x : 180, y:240};

    player_host.angle = player_host.start_angle = 270;
    player_client.angle = player_client.start_angle = 90;

}; //game_core.server_reset_positions

// This also gets called at the beginning of every new game.
// It randomizes payoffs, resets colors, and makes the targets "fresh and
// available" again.
game_core.prototype.server_reset_cities = function() {

    top_city = this.cities.top;
    bottom_city = this.cities.bottom;
    top_city.color = bottom_city.color = 'white';
    top_city.visited = bottom_city.visited = false;

    // Randomly reset payoffs
    var r = Math.floor(Math.random() * 2);

    if (r == 0) {
	this.cities.top.payoff = 1;
	this.cities.bottom.payoff = 4;
	this.best_city_string = 'bottom';
    } else {
	this.cities.top.payoff = 4;
	this.cities.bottom.payoff = 1;
	this.best_city_string = 'top';
    }
}; //game_core.server_reset_cities

game_core.prototype.client_reset_positions = function() {

    var player_host = this.players.self.host ?  this.players.self : this.players.other;
    var player_client = this.players.self.host ?  this.players.other : this.players.self;

    //Host always spawns on the left facing inward.
    player_host.pos = { x:180,y:240 }; 
    player_client.pos = { x:540, y:240 };
    player_host.angle = 90;
    player_client.angle = 270;

}; //game_core.client_reset_positions

// This is a really important function -- it gets called when a round
// has been completed, and updates the database with how much money
// people have made so far. This way, if somebody gets disconnected or
// something, we'll still know what to pay them.

game_core.prototype.server_newgame = function() {
    // Always update database to reflect outcome to this point
    var sql1 = 'UPDATE game_participant SET bonus_pay = ' + (this.players.self.points_earned / 100).toFixed(2); 
    sql1 += ' WHERE workerId = "' + this.players.self.instance.userid + '"';
    this.mysql_conn.query(sql1, function(err, rows, fields) {
	    if (err) throw err;
	    console.log('Updated sql with command: ', sql1);
	});
    var sql2 = 'UPDATE game_participant SET bonus_pay = ' + (this.players.other.points_earned / 100).toFixed(2); 
    sql2 += ' WHERE workerId = "' + this.players.other.instance.userid + '"';
    this.mysql_conn.query(sql2, function(err, rows, fields) {
	    if (err) throw err;
	    console.log('Updated sql with command: ', sql2);
	});

    // Update number of games remaining
    this.games_remaining -= 1;

    // Don't want players moving during countdown
    this.players.self.speed = 0;
    this.players.other.speed = 0;

    // Tell the server about cities being enabled, so it can use it as a flag elsewhere
    this.players.self.cities_enabled = true;
    this.players.other.cities_enabled = true;

    // Don't want to write to file during countdown -- too confusing
    this.good2write = false;

    // Reset destinations
    this.players.self.destination = null;
    this.players.other.destination = null;

    // Don't want people signalling until after countdown/validated input
    this.draw_enabled = false;

    //Reset positions
    this.server_reset_positions();

    //Reset cities
    this.server_reset_cities();

    //Tell clients about it so they can call their newgame procedure (which does countdown)
    this.instance.player_client.send('s.n.');
    this.instance.player_host.send('s.n.');
   
    var local_this = this;

    // For the dynamic version, we want there to be a countdown.
    // For the ballistic version, the game won't start until both players have
    // made valid choices so the function must be checked over and over. It's in
    // server_update_physics.
    if(this.condition == "dynamic"){
	// After countdown, players start moving, we start writing data, and clock resets
	setTimeout(function(){
		local_this.good2write = true;
		local_this.draw_enabled = true;
		local_this.players.self.speed = local_this.global_speed;
		local_this.players.other.speed = local_this.global_speed;
		local_this.game_clock = 0;
	    }, 3000);
    } 
};

// Restarts things on the client side. Necessary for iterated games.
game_core.prototype.client_newgame = function(data) {
    if (this.games_remaining == 0) {
	// Redirect to exit survey
	var URL = 'http://perceptsconcepts.psych.indiana.edu/rts/survey';
	URL += '?workerId=' + this.players.self.id;
	window.location.replace(URL);
    } else {
	// Decrement number of games remaining
	this.games_remaining -= 1;
    }

    var player_host = this.players.self.host ?  this.players.self : this.players.other;
    var player_client = this.players.self.host ?  this.players.other : this.players.self;

    // Reset angles
    player_host.angle = player_host.start_angle = 90;
    player_client.angle = player_client.start_angle = 270;

    //Update their destinations
    player_host.destination = null;
    player_client.destination = null;

    // They SHOULD see the cities information
    this.players.self.cities_enabled = true;
    this.players.other.cities_enabled = true;

    console.log("condition is " + this.condition)
    // Initiate countdown (with timeouts)
    if (this.condition == 'dynamic') {
	console.log("In dynamic version!")
	this.client_countdown();
    }

    // Set text beneath player
    this.players.self.state = 'YOU';
    this.players.other.state = '';

}; //client_newgame

game_core.prototype.client_countdown = function() {

    // setTimeout is dumb and changes the scope. So we make this local.
    var local_this = this;

    local_this.players.self.message = '          Begin in 3...';
    setTimeout(function(){local_this.players.self.message = '          Begin in 2...';}, 1000);
    setTimeout(function(){local_this.players.self.message = '          Begin in 1...';}, 2000);

    // At end of countdown, say "GO" and start using their real angle
    setTimeout(function(){
	    local_this.players.self.message = '               GO';
	}, 3000);

    // Remove message text
    setTimeout(function(){local_this.players.self.message = '';}, 4000);
}

game_core.prototype.client_onjoingame = function(data) {
    //We are not the host
    this.players.self.host = false;

    //Set colors once and for all.
    this.players.other.color = '#2288cc';
    this.players.other.info_color = '#2288cc';
    this.players.self.color = '#cc0000';
    this.players.self.info_color = '#cc0000';

    //Make sure the positions match servers and other clients
    this.client_reset_positions();

}; //client_onjoingame

// This function is triggered in a client when they first join and start a new game
game_core.prototype.client_onhostgame = function() {
    //Set the flag that we are hosting, this helps us position respawns correctly
    this.players.self.host = true;

    //Update tags below players to display state
    this.players.self.state = 'waiting for other player to join';
    this.players.other.state = 'not-connected';

    // Set their colors once and for all.
    this.players.self.color = '#2288cc';
    this.players.self.info_color = '#2288cc';
    this.players.other.color = '#cc0000';
    this.players.other.info_color = '#cc0000';

    //Make sure we start in the correct place as the host.
    this.client_reset_positions();
}; //client_onhostgame

game_core.prototype.client_onconnected = function(data) {

    //The server responded that we are now in a game,
    //this lets us store the information about ourselves
    
    this.players.self.id = data.id;
    this.players.self.online = true;

}; //client_onconnected

// This is where clients parse messages from the server. If there's
// another message you need to receive, just add another case here. To
// see the corresponding function where the server parses messages
// from clients, look for "onMessage" in game.server.js.
game_core.prototype.client_onnetmessage = function(data) {

    var commands = data.split('.');
    var command = commands[0];
    var subcommand = commands[1] || null;
    var commanddata = commands[2] || null;

    switch(command) {
    case 's': //server message

	switch(subcommand) {

	    // Permanent Message
	case 'p' :
	    this.players.self.message = commanddata;
	    break;

	case 'm' : 
	    this.players.self.message = commanddata;
	    var local_this = this;
	    setTimeout(function(){local_this.players.self.message = '';}, 1000);
	    break;
	    
	case 'alert' : // Can't play...
	    alert('You must first accept the HIT through Mechanical Turk'); 
	    window.location.replace('https://www.mturk.com/mturk/welcome'); break;

	case 'h' : //host a game requested
	    this.client_onhostgame(); break;

	case 'j' : //join a game requested
	    this.client_onjoingame(commanddata); break;

	case 'n' : //ready a game requested
	    this.client_newgame(commanddata); break;

	case 'e' : //end game requested
	    this.client_ondisconnect(commanddata); break;

	case 'a' : // other player changed angle
	    this.players.other.angle = commanddata; break;
	    
	} //subcommand

        break; //'s'
    } //command
                
}; //client_onnetmessage

game_core.prototype.client_ondisconnect = function(data) {

    // Everything goes offline!
    this.players.self.info_color = 'rgba(255,255,255,0.1)';
    this.players.self.state = 'not-connected';
    this.players.self.online = false;
    this.players.self.destination = null;
    this.players.other.info_color = 'rgba(255,255,255,0.1)';
    this.players.other.state = 'not-connected';
    
    // If the game is basically done anyway, redirect them to an exit survey
    if(this.games_remaining == 0) {
	URL = 'http://perceptsconcepts.psych.indiana.edu/rts/survey';
	URL += '?workerId=' + this.players.self.id;
	window.location.replace(URL);
    } else {
	// Redirect them to a "we're sorry, the other player disconnected" page
	URL = 'http://perceptsconcepts.psych.indiana.edu/rts/disconnected';
	URL += '?workerId=' + this.players.self.id;
	window.location.replace(URL);
    }
}; 

// Associates socket.io actions with particular functions in this class.
game_core.prototype.client_connect_to_server = function() {
        
    //Store a local reference to our connection to the server
    this.socket = io.connect();

    //When we connect, we are not 'connected' until we have a server id
    //and are placed in a game by the server. The server sends us a message for that.
    this.socket.on('connect', function(){
	    this.players.self.state = 'connecting';
	}.bind(this));

    //Sent when we are disconnected (network, server down, etc)
    this.socket.on('disconnect', this.client_ondisconnect.bind(this));
    //Sent each tick of the server simulation. This is our authoritive update
    this.socket.on('onserverupdate', this.client_onserverupdate_recieved.bind(this));
    //Handle when we connect to the server, showing state and storing id's.
    this.socket.on('onconnected', this.client_onconnected.bind(this));
    //On error we just show that we are not connected for now. Can print the data.
    this.socket.on('error', this.client_ondisconnect.bind(this));
    //On message from the server, we parse the commands and send it to the handlers
    this.socket.on('message', this.client_onnetmessage.bind(this));
}; //game_core.client_connect_to_server

// Little helper function to draw instructions at the bottom in a nice style
game_core.prototype.client_draw_info = function(info) {

    //Draw information shared by both players
    this.ctx.font = "8pt Helvetica";
    this.ctx.fillStyle = 'rgba(255,255,255,1)';
    this.ctx.fillText(info, 10 , 465); 

    //Reset the style back to full white.
    this.ctx.fillStyle = 'rgba(255,255,255,1)';

}; //game_core.client_draw_help

// Just in case we want to draw from Gaussian to get noise on movement...
function NormalDistribution(sigma, mu) {
    return new Object({
	    sigma: sigma,
		mu: mu,
		sample: function() {
		var res;
		if (this.storedDeviate) {
		    res = this.storedDeviate * this.sigma + this.mu;
		    this.storedDeviate = null;
		} else {
		    var dist = Math.sqrt(-1 * Math.log(Math.random()));
		    var angle = 2 * Math.PI * Math.random();
		    this.storedDeviate = dist*Math.cos(angle);
		    res = dist*Math.sin(angle) * this.sigma + this.mu;
		}
		return res;
	    },
		sampleInt : function() {
		return Math.round(this.sample());
	    }
    });
}

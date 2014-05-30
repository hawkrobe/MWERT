/*  Copyright (c) 2012 Sven "FuzzYspo0N" Bergström, 
                  2013 Robert XD Hawkins
    
    written by : http://underscorediscovery.com
    written for : http://buildnewgames.com/real-time-multiplayer/
    
    substantially modified for collective behavior experiments on the web

    MIT Licensed.
*/

/*
  The main game class. This gets created on both server and
  client. Server creates one for each game that is hosted, and each
  client creates one for itself to play the game. When you set a
  variable, remember that it's only set in that instance.
*/
var game_core = function(game_instance){

    // Define some variables specific to our game to avoid
    // 'magic numbers' elsewhere
    this.left_player_start_angle = 90;
    this.right_player_start_angle = 270;
    this.left_player_start_pos = { x:180, y:240 }
    this.right_player_start_pos = { x:540, y:240 }
    this.left_player_color = '#2288cc';
    this.right_player_color = '#cc0000';
    this.big_payoff = 4
    this.little_payoff = 1

    // Create targets and assign fixed position
    this.targets = {
        top :    new target({x : 360, y : 120}),
	    bottom : new target({x : 360, y : 360})};                  

    //Store the instance, if any (passed from game.server.js)
    this.instance = game_instance;

    //Store a flag if we are the server instance
    this.server = this.instance !== undefined;

    //Store a flag if a newgame has been initiated.
    //Used to prevent the loop from continuing to start newgames during timeout.
    this.newgame_initiated_flag = false;

    //Dimensions of world -- Used in collision detection, etc.
    this.world = {width : 720, height : 480};    

    //We create a player set, passing them the game that is running
    //them, as well. Both the server and the clients need separate
    //instances of both players, but the server has more information
    //about who is who. Clients will be given this info later.
    if(this.server) {
	    this.players = {
	        self : new game_player(this,this.instance.player_host),
	        other : new game_player(this,this.instance.player_client)};
	    this.game_clock = 0;
    } else {
	    this.players = {
	        self : new game_player(this),
	        other : new game_player(this)};
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
}; 

/* The player class
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
    this.targets_enabled = false;
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

    //For client instances, we'll set up these variables in client_onhostgame
    // and client_onjoingame
    if(player_instance) { // Host on left
	    this.pos = this.game.left_player_start_pos;
	    this.color = this.game.left_player_color;
	    this.angle = this.start_angle = this.game.left_player_start_angle;
    } else {             // other on right
	    this.pos = this.game.right_player_start_pos;
	    this.color = this.game.right_player_color;
	    this.angle = this.start_angle = this.game.right_player_start_angle;
    }    
}; 

// The target is the payoff-bearing goal. We construct it with these properties
var target = function(location) {
    this.payoff = 1;
    this.location = location;
    this.visited = false;
    this.radius = 10;
    this.outer_radius = this.radius + 35;
    this.color = 'white';
};

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
        tcc : this.targets.top.color,                //'top target color'
        bcc : this.targets.bottom.color,             //'bottom target color'
        tcp : this.targets.top.payoff,               //'top target payoff'
        bcp : this.targets.bottom.payoff,            //'bottom target payoff'
        cond: this.condition,                        //dynamic or ballistic?
        de  : this.draw_enabled,                    // true to see angle
        g2w : this.good2write,                      // true when game's started
    };
    //Send the snapshot to the 'host' player
    if(this.players.self.instance) 
        this.players.self.instance.emit( 'onserverupdate', this.laststate );
    
    //Send the snapshot to the 'client' player
    if(this.players.other.instance) 
        this.players.other.instance.emit( 'onserverupdate', this.laststate );    
};

// This is called every 666ms and simulates the world state. This is
// where we update positions and check whether targets have been reached.
game_core.prototype.server_update_physics = function() {

    host_player = this.players.self;
    other_player = this.players.other;
    top_target = this.targets.top;
    bottom_target = this.targets.bottom;

    // If a player has reached their destination, stop. Have to put
    // other wrapper because destination is null until player clicks
    // Must use distance from, since the player's position is at the
    // center of the body, which is long. As long as any part of the
    // body is where it should be, we want them to stop.
    if (host_player.destination) {
        if (this.distance_between(host_player.pos,host_player.destination) < 8)
            host_player.speed = 0;
    }
    if (other_player.destination) {
        if (this.distance_between(other_player.pos,other_player.destination) < 8)
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
    
    // Check whether either plays has reached a target
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
                                                top_target.location) < 10 ||
                          this.distance_between(host_player.destination, 
                                                bottom_target.location) < 10);
        }
        if (other_player.destination) {
            condition2 = (this.distance_between(other_player.destination, 
                                                top_target.location) < 10 ||
                          this.distance_between(other_player.destination, 
                                                bottom_target.location) < 10);
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
    var top_target = this.targets.top;
    var bottom_target = this.targets.bottom;

    // Check whether either target has been reached
    this.check_target_reached(top_target,bottom_target,player1,player2,whoisplayer1);
    this.check_target_reached(bottom_target,top_target,player1,player2,whoisplayer1);
    
    // If both targets have been marked as visited, we tell the server
    // we're ready to start a new game. But we only do it once, thus the flag.
    if ((top_target.visited 
         && bottom_target.visited
         && !this.newgame_initiated_flag)) {
        
        console.log("Both targets visited...");
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
}; 

// Messy helper function for our specific game -- implements 'end-game' logic
game_core.prototype.check_target_reached = function(main_target, other_target,player1,player2,whoisplayer1) {
    // If player1 reaches the top target before player2, reward them and
    // end the game
    if (this.distance_between(player1.pos,main_target.location) < main_target.radius + player1.size.hy
        && !main_target.visited
        && this.distance_between(player2.pos,main_target.location) > main_target.outer_radius + player2.size.hy) {
        main_target.visited = true;
        main_target.color = player1.color;
        player1.points_earned += main_target.payoff;
        other_target.visited = true;
        other_target.color = player2.color;
        player2.points_earned += other_target.payoff;
        if (whoisplayer1 == 'host') { 
            this.instance.player_host.send('s.m.    You earned ' + main_target.payoff + '\xA2');
            this.instance.player_client.send('s.m.    You earned ' + other_target.payoff + '\xA2');
        } else if (whoisplayer1 == 'other') {
            this.instance.player_host.send('s.m.    You earned ' + other_target.payoff + '\xA2');
            this.instance.player_client.send('s.m.    You earned ' + main_target.payoff + '\xA2');
        }
        // If it's a tie, no one wins and game over (i.e. set both targets to visited)
    } else if(this.distance_between(player1.pos,main_target.location) < main_target.radius + player1.size.hy
              && !main_target.visited
              && this.distance_between(player2.pos, main_target.location) < main_target.outer_radius + player2.size.hy) {
        // Let them know they tied...
        this.instance.player_client.send('s.m.Tie! No money awarded!');
        this.instance.player_host.send('s.m.Tie! No money awarded!');
        main_target.visited = true;
        other_target.visited = true;
        main_target.color = 'black';
    }    
};

// Every second, we print out a bunch of information to a file in a
// "data" directory. We keep EVERYTHING so that we
// can analyze the data to an arbitrary precision later on.
game_core.prototype.writeData = function() {
    // Some funny business going on with angles being negative, so we correct for that
    var host_angle_to_write = this.players.self.angle;
    var other_angle_to_write = this.players.other.angle;
    var file_path ;
    if (this.players.self.angle < 0)
        host_angle_to_write = parseInt(this.players.self.angle, 10) + 360;
    if (this.players.other.angle < 0)
        other_angle_to_write = parseInt(this.players.other.angle, 10)  + 360;
    if (this.condition == "ballistic") 
        file_path = "data/ballistic/game_" + this.game_id + ".csv";
    else if (this.condition == "dynamic") 
        file_path = "data/dynamic/game_" + this.game_id + ".csv";
    // Write data for the host player
    var host_data_line = String(this.game_number) + ',';
    host_data_line += String(this.game_clock) + ',';
    host_data_line += this.best_target_string + ',';
    host_data_line += "host,";
    host_data_line += this.players.self.pos.x + ',';
    host_data_line += this.players.self.pos.y + ',';
    host_data_line += host_angle_to_write + ',';
    host_data_line += this.players.self.points_earned + ',';
    host_data_line += this.players.self.noise.fixed(2) + ',';
    this.fs.appendFile(file_path, 
                       String(host_data_line) + "\n",
                       function (err) {
                           if(err) throw err;
                       });
    console.log("Wrote: " + host_data_line);

    // Write data for the other player
    var other_data_line = String(this.game_number) + ',';
    other_data_line += String(this.game_clock) + ',';
    other_data_line += this.best_target_string + ',';
    other_data_line += "other,";
    other_data_line += this.players.other.pos.x + ',';
    other_data_line += this.players.other.pos.y + ',';
    other_data_line += other_angle_to_write + ',';
    other_data_line += this.players.other.points_earned + ',';
    other_data_line += this.players.other.noise.fixed(2) + ',';
    this.fs.appendFile(file_path,
                       String(other_data_line) + "\n",
                       function (err) {
                           if(err) throw err;
                       });
    console.log("Wrote: " + other_data_line);
};

// This gets called every iteration of a new game to reset positions
game_core.prototype.server_reset_positions = function() {

    var player_host = this.players.self.host ? this.players.self : this.players.other;
    var player_client = this.players.self.host ? this.players.other : this.players.self;

    player_host.pos = this.right_player_start_pos;
    player_client.pos = this.left_player_start_pos;

    player_host.angle = this.right_player_start_angle;
    player_client.angle = this.left_player_start_angle;

}; 

// This also gets called at the beginning of every new game.
// It randomizes payoffs, resets colors, and makes the targets "fresh and
// available" again.
game_core.prototype.server_reset_targets = function() {

    top_target = this.targets.top;
    bottom_target = this.targets.bottom;
    top_target.color = bottom_target.color = 'white';
    top_target.visited = bottom_target.visited = false;

    // Randomly reset payoffs
    var r = Math.floor(Math.random() * 2);

    if (r == 0) {
        this.targets.top.payoff = this.little_payoff;
        this.targets.bottom.payoff = this.big_payoff;
        this.best_target_string = 'bottom';
    } else {
        this.targets.top.payoff = this.big_payoff;
        this.targets.bottom.payoff = this.little_payoff;
        this.best_target_string = 'top';
    }
}; 


// This is a really important function -- it gets called when a round
// has been completed, and updates the database with how much money
// people have made so far. This way, if somebody gets disconnected or
// something, we'll still know what to pay them.
game_core.prototype.server_newgame = function() {
    if (this.use_db) { // set in game.server.js
	    console.log("USING DB");
        var sql1 = 'UPDATE game_participant SET bonus_pay = ' + 
            (this.players.self.points_earned / 100).toFixed(2); 
        sql1 += ' WHERE workerId = "' + this.players.self.instance.userid + '"';
        this.mysql_conn.query(sql1, function(err, rows, fields) {
            if (err) throw err;
            console.log('Updated sql with command: ', sql1);
        });
        var sql2 = 'UPDATE game_participant SET bonus_pay = ' + 
            (this.players.other.points_earned / 100).toFixed(2); 
        sql2 += ' WHERE workerId = "' + this.players.other.instance.userid + '"';
        this.mysql_conn.query(sql2, function(err, rows, fields) {
            if (err) throw err;
            console.log('Updated sql with command: ', sql2);
        });
    }
    
    // Update number of games remaining
    this.games_remaining -= 1;

    // Don't want players moving during countdown
    this.players.self.speed = 0;
    this.players.other.speed = 0;

    // Tell the server about targets being enabled, so it can use it as a flag elsewhere
    this.players.self.targets_enabled = true;
    this.players.other.targets_enabled = true;

    // Don't want to write to file during countdown -- too confusing
    this.good2write = false;

    // Reset destinations
    this.players.self.destination = null;
    this.players.other.destination = null;

    // Don't want people signalling until after countdown/validated input
    this.draw_enabled = false;

    //Reset positions
    this.server_reset_positions();

    //Reset targets
    this.server_reset_targets();

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
            console.log("GOOOOOO!");
            local_this.players.self.speed = local_this.global_speed;
            local_this.players.other.speed = local_this.global_speed;
            local_this.game_clock = 0;
        }, 3000);
    } 
};

/*
  The following code should NOT need to be changed
*/

//Main update loop -- don't worry about it
game_core.prototype.update = function() {
    
    //Update the game specifics
    if(!this.server) 
        client_update();
    else 
        this.server_update();
    
    //schedule the next update
    this.updateid = window.requestAnimationFrame(this.update.bind(this), 
                                                 this.viewport);
};

//For the server, we need to cancel the setTimeout that the polyfill creates
game_core.prototype.stop_update = function() {  

    // Stop old game from animating anymore
    window.cancelAnimationFrame( this.updateid );  

    // Stop loop still running from old game (if someone is still left,
    // game_server.endGame will start a new game for them).
    clearInterval(this.physics_interval_id);
};

game_core.prototype.create_physics_simulation = function() {    
    return setInterval(function(){
        this.update_physics();
        this.game_clock += 1;
        if (this.good2write) {
            this.writeData();
        }
    }.bind(this), this.tick_frequency);
};

game_core.prototype.update_physics = function() {
    if(this.server) 
	this.server_update_physics();
};

//Prevents people from leaving the arena
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
};

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

/* Helper functions for the game code:
   Here we have some common maths and game related code to make
   working with 2d vectors easy, as well as some helpers for
   rounding numbers to fixed point.
*/

// (4.22208334636).fixed(n) will return fixed point value to n places, default n = 3
Number.prototype.fixed = function(n) { n = n || 3; return parseFloat(this.toFixed(n)); };

// Takes two location objects and computes the distance between them
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


// server side we set the 'game_core' class to a global type, so that
// it can use it in other files 
if('undefined' != typeof global) {
    module.exports = global.game_core = game_core;
}

//The remaining code runs the update animations

//The main update loop runs on requestAnimationFrame,
//Which falls back to a setTimeout loop on the server
//Code below is from Three.js, and sourced from links below

//http://paulirish.com/2011/requestanimationframe-for-smart-animating/
//http://my.opera.com/emoller/blog/2011/12/20/requestanimationframe-for-smart-er-animating

//requestAnimationFrame polyfill by Erik Möller
//fixes from Paul Irish and Tino Zijdel
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

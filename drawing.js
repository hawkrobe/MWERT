// Draw players as triangles using HTML5 canvas
draw_player = function(game, player){
    game.ctx.font = "10pt Helvetica";

    // Draw avatar as triangle
    var v = [[0,-8],[-5,8],[5,8]];
    game.ctx.save();
    game.ctx.translate(player.pos.x, player.pos.y);
    // draw_enabled is set to false during the countdown, so that
    // players can set their destinations but won't turn to face them.
    // As soon as the countdown is over, it's set to true and they
    // immediately start using that new angle
    if (player.game.draw_enabled) {
	    game.ctx.rotate((player.angle * Math.PI) / 180);
    } else {
	    game.ctx.rotate((player.start_angle * Math.PI) / 180);
    }
    // This draws the triangle
    game.ctx.fillStyle = player.color;
    game.ctx.strokeStyle = player.color;
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
    if (player.destination) {
	    game.ctx.strokeStyle = player.color;
	    game.ctx.beginPath();
	    game.ctx.moveTo(player.destination.x - 5, player.destination.y - 5);
	    game.ctx.lineTo(player.destination.x + 5, player.destination.y + 5);

	    game.ctx.moveTo(player.destination.x + 5, player.destination.y - 5);
	    game.ctx.lineTo(player.destination.x - 5, player.destination.y + 5);
	    game.ctx.stroke();
    }

    //Draw tag underneath players
    game.ctx.fillStyle = player.info_color;
    game.ctx.fillText(player.state, player.pos.x+10, player.pos.y + 20); 

    // Draw message in center (for countdown, e.g.)
    game.ctx.fillStyle = 'white';
    game.ctx.fillText(player.message, 290, 240);

    // Represent speeds in corner as a sort of bar graph (to visualize
    // the effect of noise)
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
    if (game.players.self.curr_distance_moved == 0) {
	    game.ctx.strokeStyle = 'rgba(255,255,255,0.1)';
	    game.ctx.lineTo(145 + 30, 12);
	    game.ctx.stroke();
    } else {
	    game.ctx.lineWidth = 15;
	    game.ctx.strokeStyle = 'white';
	    game.ctx.lineTo(145 + 3*game.players.self.curr_distance_moved.fixed(2), 12);
	    game.ctx.stroke();
	    game.ctx.lineWidth = 1;
    }

    // Other line...
    game.ctx.beginPath();
    game.ctx.moveTo(145, 37);
    if(game.players.other.curr_distance_moved == 0) {
	    game.ctx.strokeStyle = 'rgba(255,255,255,0.1)';
	    game.ctx.lineTo(145 + 30, 37);
	    game.ctx.stroke();
    } else {
	    game.ctx.lineWidth = 15;
	    game.ctx.strokeStyle = 'white';
	    game.ctx.lineTo(145 + 3*game.players.other.curr_distance_moved.fixed(2), 37);
	    game.ctx.stroke();
	    game.ctx.lineWidth = 1;
    }
    game.ctx.stroke();

}; 

// player.targets_enabled is set to true when both people have joined.
// Uses HTML5 canvas

draw_targets = function(game, player) {
    // Draw targets
    if (player.targets_enabled) {
	    var centerX1 = game.targets.top.location.x;
	    var centerY1 = game.targets.top.location.y;
	    var centerX2 = game.targets.bottom.location.x;
	    var centerY2 = game.targets.bottom.location.y;
	    var radius = game.targets.top.radius;
	    var outer_radius = game.targets.top.outer_radius;

	    // Filled in top target
	    game.ctx.beginPath();
	    game.ctx.arc(centerX1, centerY1, radius, 0, 2 * Math.PI, false);
	    game.ctx.fillStyle = game.targets.top.color;	
	    game.ctx.fill();
	    game.ctx.lineWidth = 1;
	    game.ctx.strokeStyle = 'gray';
	    game.ctx.stroke();

	    // Outer line around top target
	    game.ctx.beginPath();
	    game.ctx.arc(centerX1, centerY1, outer_radius, 0, 2 * Math.PI, false);
	    game.ctx.stroke();
	    
	    // Filled in bottom target
	    game.ctx.beginPath();
	    game.ctx.arc(centerX2, centerY2, radius, 0, 2 * Math.PI, false);
	    game.ctx.fillStyle = game.targets.bottom.color;
	    game.ctx.fill();
	    game.ctx.stroke();

	    // Outer line around bottom target
	    game.ctx.beginPath();
	    game.ctx.arc(centerX2, centerY2, outer_radius, 0, 2 * Math.PI, false);
	    game.ctx.stroke();
	    
	    // Draw tag next to targets (for payoff info)
	    game.ctx.fillStyle = 'white';
	    game.ctx.font = "15pt Helvetica";
	    targets = game.targets;
	    game.ctx.fillText("$0.0" + targets.top.payoff, 
                          targets.top.location.x - 27, targets.top.location.y - 50 );
	    game.ctx.fillText("$0.0" + targets.bottom.payoff, 
                          targets.bottom.location.x-27, targets.bottom.location.y+65);
    }
};

// draws instructions at the bottom in a nice style
draw_info = function(game, info) {    
    //Draw information shared by both players
    game.ctx.font = "8pt Helvetica";
    game.ctx.fillStyle = 'rgba(255,255,255,1)';
    game.ctx.fillText(info, 10 , 465); 
    
    //Reset the style back to full white.
    game.ctx.fillStyle = 'rgba(255,255,255,1)';
}; 

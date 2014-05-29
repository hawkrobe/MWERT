Local demo (from scratch)
=========================

1. Git is a popular version control and source code management system. If you're new to git, you'll need to install the latest version by following the link for [Mac](https://code.google.com/p/git-osx-installer/downloads/list) or [Windows](https://code.google.com/p/msysgit/downloads/list?q=full+installer+official+git) and downloading the first option in the list. On Mac, this will give you a set of command-line tools (restart the terminal if the git command is still not found after installation). On Windows it will give you a shell to type commands into. For Linux users, more information can be found [here](http://git-scm.com/book/en/Getting-Started-Installing-Git).

2. On Mac or Linux, use the Terminal to navigate to the location where you want to create your project, and enter 
   ```
   git clone https://github.com/hawkrobe/collective_behavior.git
   ```
   at the command line to create a local copy of this repository. On Windows, run this command in the shell you installed in the previous step.

3. Install node and npm (the node package manager) on your machine. Node.js sponsors an [official download](http://nodejs.org/download/) for all systems. For an advanced installation, there are good instructions [here](https://gist.github.com/isaacs/579814).

4. Navigate into the repository you created. You should see a file called package.json, which contains the dependencies. To install these dependencies, enter ```npm install``` at the command line. This may take a few minutes.

5. Finally, to run the experiment, enter ```node app.js``` at the command line. You should expect to see the following message:
   ```
   info  - socket.io started
       :: Express :: Listening on port 8000
   ```
   This means that you've successfully created a 'server' that can be accessed by copying and pasting 
   ```
   http://localhost:8000/index.html?id=1000&condition=dynamic 
   ```
   in one tab of your browser. You should see an avatar in a waiting room. To connect the other player in another tab for test purposes, open a new tab and use this URL with a different id:
   ```
   http://localhost:8000/index.html?id=1001&condition=dynamic 
   ```
   To see the other (staged) version of the experiment, just change "dynamic" to "ballistic" in the URL query string. Also note that if no id is provided, a unique id will be randomly generated.

Putting experiment on web server
================================

To make your experiment accessible over the internet, you'll need to put it in a publicly accessible directory of a web server, and run ```node app.js``` from that directory. To link clients to the experiment, replace "localhost" in the links given above with your web server's name. Sample templates are given for 'disconnected' and 'game over' web pages, but you may want to serve up a customized HTML document containing an exit survey or a portal to submit work (if you are using an online labor market like Amazon Mechanical Turk). To do so, you can change the URL in the ```client_newgame()``` and ```client_ondisconnect``` functions contained in **client.js**.

Integrating with MySQL
======================

First, enter your database information (i.e. user, password, and database name) in **database.js**. Next, set the ```use_db``` variable to ```true``` at the top of **app.js** and **game.server.js**. By default, the code assumes a table called ```game_participant``` with fields ```workerID``` and ```bonus_pay```, but you can change the queries at the following places in the code to fit your database:

The database is queried at only two points in the provided code. One is in **app.js** to check whether the id supplied in the query string exists in the database. If it isn't, the player is notified and referred to another site rather than being assigned a unique random id. The other location is the ```server_newgame()``` function in **game.core.js**, where we save each player’s current winnings to the database at the end of each round, just in case someone disconnects and we must pay however much they accumulated.


Code Glossary
=============

The code is divided across several distinct files. Here are the high-level description of the contents so that you can find the part you need to change for your own application:

* **game.core.js**: Contains the game logic and drawing functions. Creates game, player, and target objects and specifies their properties. This is the primary code that must be changed when specifying a different game logic (e.g. ```server_update_physics()```, ```server_newgame()```, ```writeData()```).
* **app.js**: This is the Node.js script that sets everything up to listen for clients on the specified port. It will not need to be changed, except if you want to listen on a different port (default 8000).
* **client.js**: Runs in a client's browser upon accessing the URL being served by our Node.js app. Creates a client-side game_core object, establishes a Socket.io connection between the client and the server, and specifies what happens upon starting or joining a game. This needs to be changed if introducing new Socket.io messsage (i.e. if you want to track a new client-side event), new shared variables, or new details of how games begin.
* **game.server.js**: Contains the functions to pair people up into separate 'rooms' (```findGame()```) and also species how the server acts upon messages passed from clients (```onMessage()```). This needs to be changed if you want groups of more than two people, or if you're adding new events to the Socket.io pipeline.
* **drawing.js**: Contains the HTML5 code to render graphics. Only needs to be changed if you desire a different graphical representation.
* **index.html, index.css**: Define background of page and runs necessary client-side scripts. Do not need to be changed.
* **disconnected.html, game_over.html**: Template pages to demonstrate how to refer a player out of the game upon some event. Should be replaced by pages specific to your purpose (e.g. an exit survey, a debriefing, or a link to submit the HIT on Mechanical Turk).

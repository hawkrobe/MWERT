Local experiment demo
=====================

1) On Mac or Linux, use the Terminal to navigate to the location where you want to create your project, and enter ```git clone https://github.com/hawkrobe/collective_behavior.git``` at the command line to create a local copy of this code. On Windows, you'll need to install a command-line interface first. [Msysgit](http://msysgit.github.io/) is one of the most popular.

2) Install node and npm (the node package manager) on your machine. The official download can be found [here](http://nodejs.org/download/). For an advanced installation, there are good instructions [here](https://gist.github.com/isaacs/579814).

3) Inside the git repo you cloned, you should see a file called package.json, which contains the dependencies. To install these dependencies, enter ```npm install``` at the command line.

4) To run the experiment, enter ```node app.js``` at the command line then enter the URL 

localhost:8000/index.html?id=1000&condition=dynamic 

in one tab of your browser. You should see an avatar in a waiting room. To connect the other player in another tab for test purposes, open a new tab and go to the URL

localhost:8000/index.html?id=1001&condition=dynamic 

Putting experiment on web server
================================

There is only one change that needs to be made: go into the ```app.js``` file and 

Integrating with MySQL
======================

Checkout the ```database``` branch of this repository, which includes a file ```database.js``` where you can enter database information. The database is queried at two points in the code. One is in ```app.js``` to check whether the id supplied in the query string exists in the database. The other is in the "server\_newgame" function in ```game.core.js``` to record each player's winnings on each round. 

The example queries presume a table called ```game_participant``` with fields ```workerID``` and ```bonus_pay```.

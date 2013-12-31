Local experiment demo
=====================

1) On Mac or Linux, use the Terminal to navigate to the location where you want to create your project, and enter ```git clone https://github.com/hawkrobe/collective_behavior.git``` at the command line to create a local copy of this code. On Windows, you'll need to install a command-line interface first. Msysgit is one of the most popular: http://msysgit.github.io/

2) Install node and npm (the node package manager) on your machine. The official download can be found here: http://nodejs.org/download/ 

For an advanced installation, there are good instructions at https://gist.github.com/isaacs/579814

3) Inside the git repo you cloned, you should see a file called package.json, which contains the dependencies. To install these dependencies, enter ```npm install``` at the command line.

4) To test the code, enter ```node app.js``` at the command line, then enter the URL 

localhost:8000/?id=1000&condition=dynamic 

in one tab of your browser. You should see an avatar in a waiting room. To connect the other player in another tab for test purposes, open a new tab and go to the URL

localhost:8000/?id=1001&condition=dynamic 


2) Create a MySQL database containing a table “game_participant” with columns for “workerId” and “bonus_pay”. Alternatively, you can grep for those terms and change them to fit your own pre-existing database. Plug that database name, username, and password into the database.js file. To prevent people from cheating, we don’t let mechanical turk workers play unless their workerId is already in the database from accepting the HIT, so to test it, you'll have to add a few fake ids that you keep to yourself. 

3) Change the path in app.js to point to this folder on your own system.

If everything launches correctly, you'll see a message saying

CONNECTING TO SQL.
   info  - socket.io started
         :: Express :: Listening on port 8000
SQL CONNECT SUCCESSFUL.

and can access the game by entering the following URL into a modern browser:

<servername>:8000/<filepathto>/index.html?id=<fakeidfromdatabase>&condition=ballistic

game.server.js contains the code for pairing participants up into unique games, and game.core.js contains the logic specific to my own game.

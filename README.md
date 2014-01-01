Local demo (from scratch)
=========================

1. Git is a popular version control and source code management system. If you're new to git, you'll need to install the latest version by following the link for [Mac](https://code.google.com/p/git-osx-installer/downloads/list) or [Windows](https://code.google.com/p/msysgit/downloads/list?q=full+installer+official+git) and downloading the first option in the list. On Mac, this will give you a set of command-line tools (restart the terminal if the git command is still not found after installation). On Windows it will give you a shell to type commands into. For Linux users, more information can be found [here](http://git-scm.com/book/en/Getting-Started-Installing-Git).

2. On Mac or Linux, use the Terminal to navigate to the location where you want to create your project, and enter ```git clone https://github.com/hawkrobe/collective_behavior.git``` at the command line to create a local copy of this repository. On Windows, run this command in the shell you installed at the previous step.

3. Install node and npm (the node package manager) on your machine. Node.js sponsors an [official download](http://nodejs.org/download/) for all systems. For an advanced installation, there are good instructions [here](https://gist.github.com/isaacs/579814).

4. Inside the repository you created, you should see a file called package.json, which contains the dependencies. To install these dependencies, enter ```npm install``` at the command line. This may take a few minutes.

5. To run the experiment, enter ```node app.js``` at the command line. You should expect to see the following message:
```
info  - socket.io started
    :: Express :: Listening on port 8000
```
This means that you've successfully created a 'server' that can be accessed by copying and pasting 
```
http://localhost:8000/index.html?id=1000&condition=dynamic 
```
in one tab of your browser. You should see an avatar in a waiting room. To connect the other player in another tab for test purposes, open a new tab and use this URL with a different id:
```
http://localhost:8000/index.html?id=1001&condition=dynamic 
```

Putting experiment on web server
================================

To make your experiment accessible over the internet, you'll need to put it in a publicly accessible directory of a web server. This requires one change to the code.

Integrating with MySQL
======================

Checkout the ```database``` branch of this repository, which includes a file ```database.js``` where you can enter database information. The database is queried at two points in the code. One is in ```app.js``` to check whether the id supplied in the query string exists in the database. The other is in the “server\_newgame” function in ```game.core.js``` to record each player’s winnings on each round. 

The example queries presume a table called ```game_participant``` with fields ```workerID``` and ```bonus_pay```.

# CSE312 project requirements

The owner's words, verbatim, for the MOVE row. The team repo (https://github.com/YawningByDawn/CSE312-TeamProject) must keep meeting them.

---

Here are the requirements for the project which has been developed in the backend section you are to maintain these requirements, if you wwant to move off of go, there is no issue, however a framework for this still must be used. Objectives 1-4 [except the deployment requirements of Objective 1] will be tested by:

Cloning your repo
Running "docker compose up"
Navigating to http://localhost:8080/ in a browser and testing all the features of your app
The deployment requirements of Objective 1 are tested using the link to your deployed app in your readme.

For grading purposes, we will check out your latest commit that was made before the deadline.

It is strongly recommended that you test your app by cloning a fresh copy of your repo, after the last commit for the deadline, and going through these steps. This will simulate exactly what we'll do during grading and will expose any setup issues you may have. It is common for an app to run in your working directory, but not from a fresh clone (eg. If you have dependencies installed locally in a .venv or node_modules directory, or a file/directory that was never committed). Test your app to make sure it will run during grading.


Objective 1 - Deployment
This objective is the foundation of your app. You have the freedom to choose any language, database, framework, etc for this project, and this objective is where you'll make those choices. Your app must contain the following features and structure:

Framework
You are required to use a web framework (You cannot start from a TCP socket. That's what the homework was all about). You have full freedom in choose your framework, including which language to use for this project
If you're not sure if something counts as a web framework, feel free to ask the course staff
Docker Compose
Set up your project using Docker and docker compose. Your app must run on local port 8080 after running "docker compose up". You may choose to map additional ports, but 8080 must also be available over HTTP if you do
Run nginx as a reverse proxy. This may be in a separate container using docker compose, installing nginx directly on your production server, or both
README Instructions
If there are any extra steps needed to run your app, you must add them in a section of your README in your repository. If you run nginx outside or docker compose, you must include instructions on how to set it up. You must also provide a configuration file in your repository and instructions about how to use it
This will be very important during grading. If you don't let us know how to run your app and have it available on port 8080, we cannot grade it properly
Database
You may use whatever database you'd like (ie. You do not have to use Postgres), though your database must run in a separate container that is started using docker compose (ie. A local SQLite instance is not allowed)
Home Page
Your framework serves a home page at "/". For this objective, a static page is enough
Deployment
Deploy your app on a publicly available server with a domain name and HTTPS with a valid certificate. It is recommended that you take advantage of the GitHub Student Developer Pack which includes offers for free domain names for 1 year. Add a DNS record for your domain name that points to your instance
Your certificate must be valid. It's recommended that you use Certbot to acquire a free certificate from Let's Encrypt
Requests to http:// (port 80) must redirect to the same path on https:// (port 443)
Add a link to your deployed app in the readme of your repository so we can find your deployment
Your app must still run locally at http://localhost:8080 with "docker compose up" since that's how we'll test the rest of the project. You may want to create a separate branch, or a separate compose file, for the deployed version of your app, or ensure that all feature work both with and without TLS
Security Concern - Ensure that your database is not accessible to the world. For example, if you're using MongoDB and you map your port (eg. 27017:27017) in compose.yml, anyone with an internet connection can access your database. You may want to map this port for testing purposes in your development environment, but this MUST be removed before deploying.
Security Concern - Do not commit your certificate's private key to your repo.
Security Concern - Any security concern covered in any homework also applies. This includes HTML injection, SQL injection, XSRF protection, proper cookie directives, etc. This applies to all 4 objectives. Specific security details cannot be provided due to the open-ended nature of the project

Objective 2 - Authentication with JWT's and an Auth Server
Add accounts to your app, with a twist: A separate authentication (auth) server issues JWTs, and your app verifies them without asking the auth server or the database who the user is.

Registration and Login
There should be a clear way for users to register, login, and logout. Once logged in, there should be a clear visual letting the user know that they are logged in (eg. Display their username on the home page)
Authenticated sessions must be persistent - If a user logs in then you restart all your containers, they should be able to refresh the page and still be logged in
The Auth Server
Create a separate auth server that runs in its own container. It handles all registration, login, and logout requests, and issues a JWT when a user logs in
Use nginx to route all authentication requests (/register, /login, /logout) to your auth server, and all other requests to your app. You may route more paths to your auth server if you'd like, but only these 3 are required
Auth-related requests must never be seen by your app container
JWTs
JWTs must be cryptographically signed using a private key that only your auth server can access (eg. RS256). Your app verifies them with the matching public key
Your app must verify JWTs without communicating with the auth server and without a database lookup. After the JWT is verified, you may still use the database (eg. To pull information about the user). You just can't use it to verify the user's identity
You will have to solve the problem of generating a public/private key pair, keeping the private key only on the auth server, and sharing the public key with your app. Your keys must survive a restart (Otherwise every JWT becomes invalid and your sessions are not persistent). You may give your app the public key through a shared volume, or by adding an endpoint to your auth server that returns the public key. That endpoint is the only direct communication allowed between the two
Each JWT must expire. Include the "exp" claim and reject expired tokens in your app
Security Concern - Your JWTs must be signed in a way that they cannot be forged. Your app must reject tokens with an invalid signature, tokens signed with a different algorithm than the one you chose, and expired tokens.

Objective 3 - WebSockets
This is the core of your app and the part your audience will use during your presentation. Build a feature where many users [within reason] are in the same shared space at the same time and see each other's actions as they happen. You have much freedom in what you build as long as WebSockets are actually needed to build it (eg. The lag of polling, even at a polling interval of ~500ms, would create a terrible user experience).

To check if your idea needs WebSockets, imagine every update arrived half a second late, as it might if each browser polled your server for changes. If your app would still work fine, it doesn't need WebSockets. A chat app, a turn-based game, an auction site, or a feed of new posts all work fine with a half-second delay, so none of these satisfy this objective. Players moving around a game world would feel broken with that delay.

We recommend building a real-time massively multiplayer online (MMO) game since it naturally meets every requirement for this objective. If you're lacking ideas, agar.io is an example of a game that meets all these criteria, without being overly complex. If you have an idea that isn't a game, you can still build it as long as it meets all the requirements. If you're not sure if your idea qualifies, feel free to ask the course staff.

Shared Space
There must be a visual representation of the shared space. You may choose how users join, or if every logged-in user automatically joins when they load the home page. When a user is in the shared space, they should be able to see all other users in it and what they're doing
Real-Time Updates
The actions of each user must be broadcast to all other users in real time using WebSockets. This means all users see each other's actions as they happen [minus network delays]
All users must be able to act at the same time (eg. Turn-based games are not allowed)
Your idea must need WebSockets, as described above. If your app would work just as well with a half-second delay (between a user taking an action and all other users seeing that action), this objective is not complete
There must be some form of interaction between users. This does not have to be substantial, but there must be something more than users moving around in a shared space. These interaction must benefit from WebSockets with the same "500ms delay would feel bad" criteria
Your deployed app uses WSS through nginx. Be sure your WebSocket connection still works when ran locally using HTTP
Authenticated Connections
Only logged-in users can join. Your app verifies the JWT from the WebSocket handshake request before accepting the connection, and uses the username from the verified JWT for everything that user does. A user must never be able to act as another user
You have many options for the visuals of your app. You will not be graded on how visually appealing your app is so an HTML canvas with basic shapes will suffice. If you're building a game and want to make something more impressive though, you should consider using a game framework like phaser.io.

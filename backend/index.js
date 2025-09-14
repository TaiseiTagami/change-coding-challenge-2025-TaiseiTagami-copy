


const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");

// initialize 
const app = express();
const server = http.createServer(app); 
const io = new Server(server, {
  cors: {
    origin: "*"
  }
}); 

const PORT = 5000;


app.use(cors());
app.use(express.json());

let posts = []; 
let users = [];
let postId = 1;
let commentId = 1;


io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);
  socket.emit("posts", posts);
});


// get all posts
app.get("/posts", (req, res) => {
  res.json(posts);
});


// create a new post
app.post("/posts", (req, res) => {
  const newPost = {
    id: postId++,
    username: req.body.username,
    title: req.body.title,
    bodyText : req.body.bodyText,
    likes_list: [],
    likes: 0,
    comments: [],
    createdAt: new Date().toISOString()
  };
  posts.push(newPost);

  // post-gambling only once per hour per user
  let user = users.find(u => u.username === req.body.username);
  let postGambleAmount = null;
  let now = Date.now();
  if (user) {
    if (!user.lastPostGamble || now - user.lastPostGamble > 3600000) { // 1 hour
      // 1% chance for 300 coins, otherwise 0-100 coins
      if (Math.random() < 0.01) {
        postGambleAmount = 300;
      } else {
        postGambleAmount = Math.floor(Math.random() * 101);
      }
      user.currency += postGambleAmount;
      user.lastPostGamble = now;
    }
  }

  res.status(201).json({ ...newPost, postGambleAmount });
  io.emit("posts", posts);
});


// like a post
app.post("/posts/:id/like", (req, res) => {
  const { username } = req.body;
  const post = posts.find(p => p.id == req.params.id);

  if (!post) {
    return res.json({ error: "Post not found" });
  }
  if (!username) {
    return res.json({ error: "Username required to like" });
  }

  // toggle like: remove if already liked
  if (post.likes_list.includes(username)) {
    post.likes_list = post.likes_list.filter(u => u !== username);
    // remove likes previously given by this user
    if (!post.likes_given) post.likes_given = {};
    if (post.likes_given[username]) {
      post.likes -= post.likes_given[username];
      delete post.likes_given[username];
    }
    res.json({ ...post, likeGamble: 0 });
    io.emit("posts", posts);
    return;
  }

  // weights to make lower like amounts more likely
  const weights = [30, 25, 15, 10, 7, 5, 4, 2, 1, 1]; // 1-10
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.floor(Math.random() * total);
  let likeAmount = 1;
  for (let i = 0; i < weights.length; i++) {
    if (r < weights[i]) {
      likeAmount = i + 1;
      break;
    }
    r -= weights[i];
  }

  post.likes_list.push(username);
  if (!post.likes_given) post.likes_given = {};
  post.likes_given[username] = likeAmount;
  post.likes = (post.likes || 0) + likeAmount;

  res.json({ ...post, likeGamble: likeAmount });
  io.emit("posts", posts);
});


// add a comment to a post
app.post("/posts/:id/comment", (req, res) => {
  const { username, text } = req.body;
  const post = posts.find(p => p.id == req.params.id);

  if (!post) {
    return res.json({ error: "Post not found" });
  }
  if (!username || !text) {
    return res.json({ error: "Username and text required" });
  }

  // create comment object
  const newComment = {
    id: commentId++,
    username,
    text,
    createdAt: new Date().toISOString()
  };

  post.comments.push(newComment);
  res.json(post);
  io.emit("posts", posts);
});


// user login/register
app.post("/login", (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.json({ error: "Username and password are required" });
  }

  let user = users.find(u => u.username === username);

  if (!user) {
    // register
    user = { username, password, currency: 0, gambledPosts: [], gambleHistory: {} };
    users.push(user);
    return res.json({ message: "New user registered", username: user.username, currency: user.currency, gambleHistory: user.gambleHistory });
  } else if (user.password === password) {
    return res.json({ message: "Login successful", username: user.username, currency: user.currency, gambleHistory: user.gambleHistory });
  } else {
    return res.json({ error: "Invalid password" });
  }
});


// gamble on a post
app.post("/posts/:id/gamble", (req, res) => {
  const { username } = req.body;
  const postId = parseInt(req.params.id);
  const post = posts.find(p => p.id === postId);

  if (!post) {
    return res.json({ error: "Post not found" });
  }
  if (!username) {
    return res.json({ error: "Username required" });
  }
  let user = users.find(u => u.username === username);
  if (!user) {
    return res.json({ error: "User not found" });
  }
  if (post.username === username) {
    return res.json({ error: "Cannot gamble on your own post" });
  }
  if (user.gambledPosts.includes(postId)) {
    const prevAmount = user.gambleHistory[postId] || 0;
    return res.json({ error: "Already gambled on this post", amount: prevAmount, currency: user.currency });
  }

  // 1% chance for 1000 coins, otherwise 0-100 coins
  let amount = 0;
  if (Math.random() < 0.01) {
    amount = 1000;
  } else {
    amount = Math.floor(Math.random() * 101);
  }
  user.currency += amount;
  user.gambledPosts.push(postId);
  user.gambleHistory[postId] = amount;
  return res.json({ message: "Gamble complete", amount, currency: user.currency });
});




// start the server
server.listen(PORT, () => console.log(`Backend running on http://localhost:${PORT}`));

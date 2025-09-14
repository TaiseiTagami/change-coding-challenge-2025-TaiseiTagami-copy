



<script setup>
// sorry, I hope this is not too messy and that I don't need too many comments :(

import { ref, onMounted } from "vue";
import axios from "axios";
import { io } from "socket.io-client";


function formatDate(isoString) {
  if (!isoString) return "";
  const date = new Date(isoString);
  return date.toLocaleString();
}

const posts = ref([]); 
const newTitle = ref(""); 
const newBodyText = ref(""); 

const loggedInUser = ref(null); 
const username = ref(""); 
const password = ref(""); 
const newComments = ref({});

const currency = ref(0);

//gambling
const gambledPosts = ref([]);
const gambleResult = ref({});
const gambleSpinning = ref({});
const gambleLoadingStep = ref({});
const gambleHistory = ref({});

const reelsMode = ref(false);
const currentReelIndex = ref(0);
const postGambleMessage = ref("");
const likeGambleMessage = ref({});

// runs when it starts
onMounted(async () => {
  const res = await axios.get("http://localhost:5000/posts");
    posts.value = [...res.data].reverse();

  const socket = io("http://localhost:5000");

  socket.on("posts", (updatedPosts) => {
    posts.value = [...updatedPosts].reverse(); 

  });
});

// authentication

async function login() {
  try {
    const res = await axios.post("http://localhost:5000/login", {
      username: username.value,
      password: password.value
    });
    loggedInUser.value = res.data.username;
    currency.value = res.data.currency || 0;
    gambleHistory.value = res.data.gambleHistory || {};
    gambledPosts.value = Object.keys(gambleHistory.value).map(id => parseInt(id));
  } catch (error) {
    console.error("Login failed", error);
  }
}

// Gambling logic
async function gamble(postId) {
  if (!loggedInUser.value) {
    alert("You must be logged in to gamble.");
    return;
  }
  if (gambledPosts.value.includes(postId)) {
    alert("You already gambled on this post!");
    return;
  }
  gambleSpinning.value[postId] = true;
  gambleResult.value[postId] = "";
  gambleLoadingStep.value[postId] = 0;
  // Animate loading bar
  let step = 0;
  const interval = setInterval(() => {
    step++;
    gambleLoadingStep.value[postId] = step;
    if (step === 3) {
      clearInterval(interval);
      setTimeout(async () => {
        try {
          const res = await axios.post(`http://localhost:5000/posts/${postId}/gamble`, {
            username: loggedInUser.value
          });
          if (res.data.error) {
            gambleResult.value[postId] = res.data.error;
            gambleSpinning.value[postId] = false;
            if (typeof res.data.amount !== 'undefined') {
              gambleHistory.value[postId] = res.data.amount;
            }
            return;
          }
          currency.value = res.data.currency;
          gambleResult.value[postId] = `You won ${res.data.amount} coins!`;
          gambledPosts.value.push(postId);
          gambleHistory.value[postId] = res.data.amount;
        } catch (err) {
          gambleResult.value[postId] = "Gamble failed.";
        }
        gambleSpinning.value[postId] = false;
      }, 300);
    }
  }, 300);
}

// posts

async function addPost() {
  if (!loggedInUser.value) {
    alert("You must be logged in to post.");
    return;
  }

  const res = await axios.post("http://localhost:5000/posts", {
    username: loggedInUser.value,
    title: newTitle.value,
    bodyText: newBodyText.value
  });

  newTitle.value = "";
  newBodyText.value = "";

  // Show post-gamble result if present
  if (typeof res.data.postGambleAmount === "number") {
    currency.value += res.data.postGambleAmount;
    postGambleMessage.value = `You won ${res.data.postGambleAmount} coins from posting!`;
  } else {
    postGambleMessage.value = "Post-gamble not available (limit: once per hour).";
  }
  setTimeout(() => { postGambleMessage.value = ""; }, 10000);
}

// likes

async function likePost(postId) {
  if (!loggedInUser.value) {
    alert("You must be logged in to like posts.");
    return;
  }
  try {
    const res = await axios.post(`http://localhost:5000/posts/${postId}/like`, {
      username: loggedInUser.value
    });
    const updatedPost = res.data;
    const index = posts.value.findIndex(p => p.id === postId);
    if (index !== -1) {
      posts.value[index] = updatedPost;
    }
    // Show like-gamble result
    if (res.data.likeGamble === 0) {
      likeGambleMessage.value[postId] = "Like removed.";
    }
  } catch (err) {
    console.log("Failed to like post, error:", err);
    alert("Uh oh, could not like post ): Maybe try reloading?");
  }
}

// comments

async function comment(postId) {
  if (!loggedInUser.value) {
    console.log("Comment attempted without login")
    alert("You must be logged in to comment.");
    return;
  }

  const commentText = newComments.value[postId] || "";
  if (!commentText.trim()) {
    console.log("Empty comment attempted")
    alert("Comment cannot be empty.");
    return;
  }

  try {
    const res = await axios.post(`http://localhost:5000/posts/${postId}/comment`, {
      username: loggedInUser.value,
      text: commentText
    });
    console.log("Adding comment:" + commentText);
    console.log("Comment username:" + loggedInUser.value);
    const updatedPost = res.data;

    newComments.value[postId] = "";
  } catch {
    console.log("Failed to add comment");
    alert("Uh oh, could not add comment ): Maybe try reloading?");
  }
}

// reels code

function toggleReelsMode() {
  reelsMode.value = !reelsMode.value;
  currentReelIndex.value = 0;
  console.log("Reels mode toggled: " + reelsMode.value)
}

function nextReel() {
  if (currentReelIndex.value < posts.value.length - 1) {
    currentReelIndex.value++;
  }
}

function prevReel() {
  if (currentReelIndex.value > 0) {
    currentReelIndex.value--;
  }
}
</script>


<template>
  <div class="app-wrapper">
    <header>
      <div class="header-content">
        <div class="header-title">
          <h1>Instagamble</h1>
        </div>
        <div class="header-user">
          <div v-if="!loggedInUser" class="login-form">
            <input v-model="username" placeholder="Username" />
            <input v-model="password" type="password" placeholder="Password" />
            <button @click="login()">Login</button>
          </div>
          <div v-if="loggedInUser" class="logged-in-user">
            <span>{{ username }}</span>
            <span class="header-currency">Currency: {{ currency }}</span>
          </div>
        </div>
      </div>
    </header>

    <main>
      <button @click="toggleReelsMode" class="toggle-reels-btn">
        {{ reelsMode ? 'Switch to List Mode' : 'Switch to Reels Mode' }}
      </button>

      <!-- title input -->
      <div class="post-inputs">
        <input v-model="newTitle" placeholder="Write title..." />
        <button @click="addPost">Post</button>
      </div>
      <div v-if="postGambleMessage" class="post-gamble-message">{{ postGambleMessage }}</div>

      <!-- body input -->
      <div class="post-inputs">
        <textarea
          v-model="newBodyText"
          placeholder="Write body..."
          :class="{ expanded: newBodyText.length > 0 }"
          rows="1"
        ></textarea>
      </div>

      <!-- reels mode -->
      <div v-if="reelsMode && posts.length" class="reels-view">
        <div class="posts">
          <p>Posted by: {{ posts[currentReelIndex].username }}</p>
          <p>{{ posts[currentReelIndex].title }}</p>
          <p>{{ posts[currentReelIndex].bodyText }}</p>
          <p class="post-date">Posted at: {{ formatDate(posts[currentReelIndex].createdAt) }}</p>

          <div class="post-actions-row">
            <button
              @click="gamble(posts[currentReelIndex].id)"
              :disabled="gambledPosts.includes(posts[currentReelIndex].id) || gambleSpinning[posts[currentReelIndex].id]"
              class="gamble-button"
            >
              <template v-if="gambledPosts.includes(posts[currentReelIndex].id) && gambleHistory[posts[currentReelIndex].id] !== undefined">
                {{ gambleHistory[posts[currentReelIndex].id] }} coins
              </template>
              <template v-else>
                {{ gambleSpinning[posts[currentReelIndex].id] ? 'Spinning...' : 'Gamble' }}
              </template>
            </button>
            <button
              @click="likePost(posts[currentReelIndex].id)"
              :class="['like-button', loggedInUser && posts[currentReelIndex].likes_given && posts[currentReelIndex].likes_given[loggedInUser] !== undefined ? 'liked' : 'unliked']"
            >
              <img src="./assets/like_button.png" alt="like" />
              <p>
                {{ posts[currentReelIndex].likes }}
                <span v-if="loggedInUser && posts[currentReelIndex].likes_given && posts[currentReelIndex].likes_given[loggedInUser] !== undefined">
                  ({{ posts[currentReelIndex].likes_given[loggedInUser] }})
                </span>
              </p>
            </button>
          </div>

          <div v-if="gambleSpinning[posts[currentReelIndex].id]" class="gamble-loading-bar">
            <span
              v-for="n in 3"
              :key="n"
              class="loading-box"
              :class="{ filled: n <= (gambleLoadingStep[posts[currentReelIndex].id] || 0) }"
            >&#9632;</span>
            <span class="loading-label">Gambling...</span>
          </div>
          <div v-else-if="gambleResult[posts[currentReelIndex].id]" class="gamble-result">
            {{ gambleResult[posts[currentReelIndex].id] }}
          </div>

          <div class="comments">
            <h4>Comments:</h4>
            <div v-for="comment in posts[currentReelIndex].comments" :key="comment.id">
              <p>
                <strong>{{ comment.username }}:</strong> {{ comment.text }}
                <span class="comment-date">({{ formatDate(comment.createdAt) }})</span>
              </p>
            </div>
            <textarea
              v-model="newComments[posts[currentReelIndex].id]"
              placeholder="Add a comment..."
              :class="{ expanded: newComments[posts[currentReelIndex].id] && newComments[posts[currentReelIndex].id].length > 2 }"
              rows="1"
            ></textarea>
            <button @click="comment(posts[currentReelIndex].id)">Comment</button>
          </div>
        </div>

        <div class="reels-nav">
          <button @click="prevReel" :disabled="currentReelIndex === 0">&#8593; Prev</button>
          <span>{{ currentReelIndex + 1 }} / {{ posts.length }}</span>
          <button @click="nextReel" :disabled="currentReelIndex === posts.length - 1">Next &#8595;</button>
        </div>
      </div>

      <!-- list mode -->
      <div v-else>
        <div v-for="post in posts" :key="post.id" class="posts">
          <p>Posted by: {{ post.username }}</p>
          <p>{{ post.title }}</p>
          <p>{{ post.bodyText }}</p>
          <p class="post-date">Posted at: {{ formatDate(post.createdAt) }}</p>

          <div class="post-actions-row">
            <button
              @click="gamble(post.id)"
              :disabled="gambledPosts.includes(post.id) || gambleSpinning[post.id]"
              class="gamble-button"
            >
              <template v-if="gambledPosts.includes(post.id) && gambleHistory[post.id] !== undefined">
                {{ gambleHistory[post.id] }} coins
              </template>
              <template v-else>
                {{ gambleSpinning[post.id] ? 'Spinning...' : 'Gamble' }}
              </template>
            </button>
            <button
              @click="likePost(post.id)"
              :class="['like-button', loggedInUser && post.likes_given && post.likes_given[loggedInUser] !== undefined ? 'liked' : 'unliked']"
            >
              <img src="./assets/like_button.png" alt="like" />
              <p>
                {{ post.likes }}
                <span v-if="loggedInUser && post.likes_given && post.likes_given[loggedInUser] !== undefined">
                  ({{ post.likes_given[loggedInUser] }})
                </span>
              </p>
            </button>
          </div>

          <div v-if="gambleSpinning[post.id]" class="gamble-loading-bar">
            <span
              v-for="n in 3"
              :key="n"
              class="loading-box"
              :class="{ filled: n <= (gambleLoadingStep[post.id] || 0) }"
            >&#9632;</span>
            <span class="loading-label">Gambling...</span>
          </div>
          <div v-else-if="gambleResult[post.id]" class="gamble-result">
            {{ gambleResult[post.id] }}
          </div>

          <div class="comments">
            <h4>Comments:</h4>
            <div v-for="comment in post.comments" :key="comment.id">
              <p>
                <strong>{{ comment.username }}:</strong> {{ comment.text }}
                <span class="comment-date">({{ formatDate(comment.createdAt) }})</span>
              </p>
            </div>
            <textarea
              v-model="newComments[post.id]"
              placeholder="Add a comment..."
              :class="{ expanded: newComments[post.id] && newComments[post.id].length > 2 }"
              rows="1"
            ></textarea>
            <button @click="comment(post.id)">Comment</button>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>


<style>

/*what happened here oml*/

.app-wrapper {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  max-width: 600px;
  margin: 0 auto;
  box-sizing: border-box;
  background-color: #000000;
}
header {
  width: 100%;
  padding: 1rem 0 0.5rem 0;
  border-bottom: 1px solid #eee;
header {
  width: 100%;
  padding: 1rem 0 0.5rem 0;
  border-bottom: 1px solid #eee;
}
.header-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.header-title {
  flex: 1;
  text-align: left;
}
.header-user {
  display: flex;
  align-items: center;
  gap: 16px;
}
.logged-in-user {
  display: flex;
  align-items: center;
  gap: 12px;
}
.header-currency {
  font-weight: bold;
  color: #ffd700;
}
}
main {
  flex: 1;
  width: 100%;
  min-height: 80vh;
  box-sizing: border-box;
}
button {
  background: #ff6b6b;
  border: none;
  padding: 8px 12px;
  border-radius: 6px;
  color: white;
}

.posts {
  margin-top: 1rem;
  border: 1px solid #ccc;
  padding: 1rem;
  min-height: 180px;
  box-sizing: border-box;
  background: #111;
}

/* Like button base style */
/* Like button base style */
.like-button {
  border: none;
  cursor: pointer;
  transition: background 0.2s, opacity 0.2s;
}
.like-button.liked {
  background: #ff2222;
  opacity: 1;
}
.like-button.unliked {
  background: #333;
  color: #e0e0e0;
  opacity: 1;
}

.like-button img {
  width: 24px;
  height: 24px;
}

.comments {
  margin-top: 1rem;
  border-top: 1px solid #ccc;
  padding-top: 1rem;
}
/* Add some spacing for dates */
.post-date {
  font-size: 0.9em;
  color: #cfcfcf;
  margin-bottom: 0.5em;
}
.comment-date {
  font-size: 0.8em;
  color: #cfcfcf;
  margin-left: 0.5em;
}

input, textarea {
  padding: 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 1.1em;
  background-color: #1c1c1c !important; /* lighter than main background */
  color: #cfcfcf !important;
  resize: none;
  transition: height 0.2s;
  overflow-y: auto;
  width: 100%;
  box-sizing: border-box;
}
.login-form input {
  background-color: #000 !important;
  color: #fff !important;
}


.post-inputs {
  display: flex;
  row-gap: 20px;
  column-gap: 0px;
  align-items: center;
}

.post-inputs input {
  flex: 1 1 auto;
  width: auto;
  box-sizing: border-box;
}
.post-inputs button {
  flex: 0 0 auto;
}

body, .app-wrapper {
  background-color: #000000;
}

.post-inputs input,
.post-inputs textarea {
  flex: 1 1 auto;
  width: auto;
  box-sizing: border-box;
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
}
.post-inputs button {
  flex: 0 0 auto;
  border-top-left-radius: 0;
  border-bottom-left-radius: 0;
}

.post-inputs input,
.post-inputs button {
  height: 40px;
  transition: height 0.2s;
}
.post-inputs input.expanded,
.post-inputs textarea.expanded {
  height: 200px !important;
  padding-top: 8px;
  display: block;
}


/* Reels  */
.reels-view {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  width: 100%;
  box-sizing: border-box;
  background: #111;
}
.reels-nav {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-top: 16px;
}
.toggle-reels-btn {
  margin-bottom: 1rem;
  background: #222;
  color: #fff;
  border-radius: 6px;
  padding: 8px 16px;
  border: none;
  cursor: pointer;
}


/* Gambling styles */
.gamble-button {
  background: #ffd700;
  color: #222;
  border: none;
  border-radius: 6px;
  padding: 8px 12px;
  margin-left: 8px;
  margin-bottom: 8px;
  cursor: pointer;
}
.gamble-button:disabled {
  background: #444;
  color: #aaa;
  cursor: not-allowed;
}
.gamble-result {
  margin: 8px 0;
  color: #ffd700;
  font-weight: bold;
}

/* the gamblebar */
.gamble-loading-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 8px 0;
}
.loading-box {
  font-size: 1.5em;
  color: #444;
  transition: color 0.2s;
}
.loading-box.filled {
  color: #ffd700;
}
.loading-label {
  color: #ffd700;
  font-weight: bold;
  margin-left: 6px;
}

.gamble-history {
  margin-left: 10px;
  color: #ffd700;
  font-weight: bold;
}

.like-gamble-history {
  margin: 6px 0;
  color: #ff6b6b;
  font-weight: bold;
  text-align: left;
}

.post-inputs {
  display: flex;
  row-gap: 20px;
  column-gap: 0px;
  align-items: center;
}
.post-actions-row {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}



</style>

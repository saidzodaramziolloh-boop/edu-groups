const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const mongoose = require("mongoose");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const MAIN_ADMIN = "admin";

// ========== МОНГОДБ ПАЙВАСТШАВӢ ==========
// Варианти 1: MongoDB Atlas (тавсия) - пайванди худро гузоред
// Варианти 2: Local - mongodb://127.0.0.1:27017/edugroups
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/edugroups";

const SUBJECTS = [
  "HTML", "CSS", "Kotlin", "Python", "Algebra",
  "Physics", "Chemistry", "Zoology", "Technology", "Geography"
];

// ========== МОДЕЛҲО ==========
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true },
  isMainAdmin: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

const groupSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  subject: { type: String, required: true },
  owner: { type: String, required: true },
  admins: [{ type: String }],
  members: [{ type: String }],
  points: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

const messageSchema = new mongoose.Schema({
  groupId: { type: mongoose.Schema.Types.ObjectId, ref: "Group", required: true },
  username: { type: String, required: true },
  text: { type: String, default: "" },
  type: { type: String, default: "text" }, // text | question
  isAdmin: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model("User", userSchema);
const Group = mongoose.model("Group", groupSchema);
const Message = mongoose.model("Message", messageSchema);

// ========== ПАЙВАСТШАВӢ БА МОНГОДБ ==========
async function connectDB() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("✅ MongoDB пайваст шуд");
  } catch (err) {
    console.error("❌ Хатогии MongoDB:", err.message);
    console.log("\n📌 Чӣ кор кунед:");
    console.log("1. MongoDB-ро насб кунед ё MongoDB Atlas истифода баред");
    console.log("2. Ё MONGODB_URI-ро дар муҳити система гузоред\n");
    process.exit(1);
  }
}

app.use(express.static(path.join(__dirname, "public")));

io.on("connection", (socket) => {
  console.log("Пайваст:", socket.id);

  // ----- LOGIN -----
  socket.on("login", async ({ username }, cb) => {
    try {
      const name = (username || "").trim();
      if (name.length < 2) return cb({ error: "Ном бояд ҳадди ақал 2 ҳарф бошад" });

      let user = await User.findOne({ username: name });
      if (!user) {
        user = await User.create({
          username: name,
          isMainAdmin: name.toLowerCase() === MAIN_ADMIN.toLowerCase()
        });
      }

      socket.username = name;
      const groups = await Group.find().lean();

      cb({
        success: true,
        user: {
          username: user.username,
          isMainAdmin: user.isMainAdmin
        },
        subjects: SUBJECTS,
        groups
      });
      console.log("Ворид шуд:", name);
    } catch (err) {
      console.error(err);
      cb({ error: "Хатогии сервер" });
    }
  });

  // ----- CREATE GROUP -----
  socket.on("create_group", async ({ name, subject }, cb) => {
    try {
      if (!socket.username) return cb({ error: "Аввал ворид шавед" });
      if (!name || !subject) return cb({ error: "Ном ва фан лозим аст" });
      if (!SUBJECTS.includes(subject)) return cb({ error: "Фан нодуруст" });

      const group = await Group.create({
        name: name.trim(),
        subject,
        owner: socket.username,
        admins: [socket.username],
        members: [socket.username],
        points: 0
      });

      const plain = group.toObject();
      cb({ success: true, group: plain });
      io.emit("group_created", plain);
      console.log("Гуруҳ сохта шуд:", name, "аз ҷониби", socket.username);
    } catch (err) {
      console.error(err);
      cb({ error: "Хатогии сервер" });
    }
  });

  // ----- JOIN GROUP -----
  socket.on("join_group", async ({ groupId }, cb) => {
    try {
      if (!socket.username) return cb({ error: "Аввал ворид шавед" });

      const g = await Group.findById(groupId);
      if (!g) return cb({ error: "Гуруҳ ёфт нашуд" });

      if (!g.members.includes(socket.username)) {
        g.members.push(socket.username);
        await g.save();
      }
      socket.join(groupId);

      const msgs = await Message.find({ groupId })
        .sort({ createdAt: 1 })
        .limit(150)
        .lean();

      cb({
        success: true,
        group: g.toObject(),
        messages: msgs
      });
    } catch (err) {
      console.error(err);
      cb({ error: "Хатогии сервер" });
    }
  });

  // ----- SEND MESSAGE -----
  socket.on("send_message", async ({ groupId, text, type }, cb) => {
    try {
      if (!socket.username) return cb({ error: "Аввал ворид шавед" });

      const g = await Group.findById(groupId);
      if (!g) return cb({ error: "Гуруҳ ёфт нашуд" });
      if (!g.members.includes(socket.username)) {
        return cb({ error: "Шумо аъзои ин гуруҳ нестед" });
      }

      const user = await User.findOne({ username: socket.username });
      const isAdmin = g.admins.includes(socket.username) || (user && user.isMainAdmin);

      const msg = await Message.create({
        groupId,
        username: socket.username,
        text: text || "",
        type: type || "text",
        isAdmin
      });

      const plain = msg.toObject();
      plain.id = plain._id;

      io.to(groupId).emit("new_message", plain);
      cb({ success: true });
    } catch (err) {
      console.error(err);
      cb({ error: "Хатогии сервер" });
    }
  });

  // ----- ADD ADMIN -----
  socket.on("add_admin", async ({ groupId, username }, cb) => {
    try {
      if (!socket.username) return cb({ error: "Аввал ворид шавед" });

      const g = await Group.findById(groupId);
      if (!g) return cb({ error: "Гуруҳ ёфт нашуд" });

      const me = await User.findOne({ username: socket.username });
      const isMain = me && me.isMainAdmin;
      const isOwner = g.owner === socket.username;

      if (!isMain && !isOwner) {
        return cb({ error: "Танҳо админи асосӣ ё соҳиби гуруҳ" });
      }
      if (!g.members.includes(username)) {
        return cb({ error: "Ин шахс аъзои гуруҳ нест" });
      }
      if (!g.admins.includes(username)) {
        g.admins.push(username);
        await g.save();
      }

      const plain = g.toObject();
      cb({ success: true, group: plain });
      io.to(groupId).emit("group_updated", plain);
    } catch (err) {
      console.error(err);
      cb({ error: "Хатогии сервер" });
    }
  });

  // ----- ADD POINTS -----
  socket.on("add_points", async ({ groupId, points }, cb) => {
    try {
      if (!socket.username) return cb({ error: "Аввал ворид шавед" });

      const g = await Group.findById(groupId);
      if (!g) return cb({ error: "Гуруҳ ёфт нашуд" });

      const me = await User.findOne({ username: socket.username });
      const isMain = me && me.isMainAdmin;
      const isAdmin = g.admins.includes(socket.username);

      if (!isMain && !isAdmin) {
        return cb({ error: "Танҳо админҳо метавонанд нуқта диҳанд" });
      }

      g.points += Number(points) || 0;
      await g.save();

      const plain = g.toObject();
      cb({ success: true, group: plain });
      io.emit("group_updated", plain);
    } catch (err) {
      console.error(err);
      cb({ error: "Хатогии сервер" });
    }
  });

  // ----- LEADERBOARD -----
  socket.on("get_leaderboard", async (cb) => {
    try {
      const list = await Group.find()
        .sort({ points: -1 })
        .select("name subject points members")
        .lean();

      cb({
        leaderboard: list.map(g => ({
          id: g._id,
          name: g.name,
          subject: g.subject,
          points: g.points,
          members: g.members.length
        }))
      });
    } catch (err) {
      console.error(err);
      cb({ leaderboard: [] });
    }
  });

  // ----- DELETE ACCOUNT -----
  socket.on("delete_account", async (cb) => {
    try {
      if (!socket.username) return cb({ error: "Аввал ворид шавед" });
      const name = socket.username;

      await Group.updateMany(
        {},
        {
          $pull: {
            members: name,
            admins: name
          }
        }
      );

      await User.deleteOne({ username: name });
      cb({ success: true });
      console.log("Акаунт нест шуд:", name);
    } catch (err) {
      console.error(err);
      cb({ error: "Хатогии сервер" });
    }
  });

  socket.on("disconnect", () => {
    console.log("Ҷудо шуд:", socket.id);
  });
});

// ========== ОҒОЗ ==========
connectDB().then(() => {
  server.listen(PORT, () => {
    console.log(`\n✅ EduGroups кор мекунад: http://localhost:${PORT}`);
    console.log(`👑 Админи асосӣ: "${MAIN_ADMIN}"`);
    console.log(`🗄️  MongoDB: ${MONGODB_URI}\n`);
  });
});

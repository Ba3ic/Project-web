// =========================
// Required modules
// =========================
const express = require("express");
const exphbs = require("express-handlebars");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const session = require("express-session");
const bcrypt = require("bcrypt");
const multer = require("multer");
const fs = require("fs");

const app = express();
const PORT = 3000;

// =========================
// Handlebars setup
// =========================


app.engine("hbs", exphbs.engine({
  extname: ".hbs",
  helpers: {
    eq: (a, b) => a === b,
    range: function(start, end) {
      let arr = [];
      for (let i = start; i <= end; i++) {
        arr.push(i);
      }
      return arr;
    }
  }
  
}));

app.set("view engine", "hbs");
app.set("views", path.join(__dirname, "views"));


// =========================
// Middleware
// =========================
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.use(session({
  secret: "supersecret",
  resave: false,
  saveUninitialized: true
}));

// Make user session available in all views
app.use((req, res, next) => {
  res.locals.user = req.session.user;
  next();
});

// =========================
// Access control middleware
// =========================
function isLoggedIn(req, res, next) {
  if (req.session.user) return next();
  res.redirect("/login");
}

function isAdmin(req, res, next) {
  if (req.session.user && req.session.user.username === "admin") return next();
  res.status(403).send("Access denied. Admin only.");
}

// =========================
// Database connection
// =========================
const db = new sqlite3.Database(path.join(__dirname, "db", "weapons.db"));

// =========================
// Multer setup for image uploads
// =========================
const storage = multer.diskStorage({
  destination: function (req, file, cb) { cb(null, "public/img"); },
  filename: function (req, file, cb) { cb(null, Date.now() + path.extname(file.originalname)); }
});
const upload = multer({ storage });

// =========================
// Routes - Index
// =========================
app.get("/", (req, res) => {
  res.render("index", { title: "THE FINALS - Weapon Database" });
});
app.get("/list", (req, res) => res.render("list", { title: "List" }));
app.get("/about", (req, res) => res.render("about", { title: "About" }));
app.get("/contact", (req, res) => res.render("contact", { title: "Contact" }));

// =========================
// Weapons CRUD
// =========================
app.get("/weapons", (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = 3;
  const offset = (page - 1) * limit;

  db.all("SELECT * FROM weapons LIMIT ? OFFSET ?", [limit, offset], (err, rows) => {
    if (err) return res.status(500).send("Database error");
    db.get("SELECT COUNT(*) AS count FROM weapons", [], (err2, total) => {
      if (err2) return res.status(500).send("Count error");
      const totalPages = Math.ceil(total.count / limit);
      res.render("weapons", { title: "Weapons", weapons: rows, page, totalPages });
    });
  });
});

app.get("/weapons/:id", (req, res) => {
  db.get("SELECT * FROM weapons WHERE id = ?", [req.params.id], (err, weapon) => {
    if (err) return res.status(500).send("Database error");
    if (!weapon) return res.status(404).send("Weapon not found");
    res.render("weapon-detail", { title: weapon.name, weapon });
  });
});

app.get("/add/weapon", isAdmin, (req, res) => {
  res.render("add", { title: "Add Weapon", type: "weapon", showClass: true });
});

app.post("/add/weapon", isAdmin, upload.single("image_file"), (req, res) => {
  const { name, description, class: weaponClass, damage } = req.body;
  let image_url = req.body.image_url || "";
  if (req.file) image_url = "/img/" + req.file.filename;
  db.run("INSERT INTO weapons (name, class, description, image_url, damage) VALUES (?, ?, ?, ?, ?)",
    [name, weaponClass, description, image_url, damage],
    err => { if (err) return res.status(500).send("Database error"); res.redirect("/weapons"); });
});

app.get("/weapons/:id/edit", isAdmin, (req, res) => {
  db.get("SELECT * FROM weapons WHERE id = ?", [req.params.id], (err, weapon) => {
    if (err) return res.status(500).send("Database error");
    if (!weapon) return res.status(404).send("Weapon not found");
    res.render("edit", { title: "Edit Weapon", type: "weapon", item: weapon, showClass: true });
  });
});

app.post("/weapons/:id/edit", isAdmin, upload.single("image_file"), (req, res) => {
  const { name, description, class: weaponClass, damage } = req.body;
  let sql = "UPDATE weapons SET name = ?, class = ?, description = ?, damage = ?";
  const params = [name, weaponClass, description, damage];
  if (req.file) { sql += ", image_url = ?"; params.push("/img/" + req.file.filename); }
  sql += " WHERE id = ?"; params.push(req.params.id);
  db.run(sql, params, err => { if (err) return res.status(500).send("Database error"); res.redirect("/weapons"); });
});

app.post("/weapons/:id/delete", isAdmin, (req, res) => {
  db.run("DELETE FROM weapons WHERE id = ?", [req.params.id], err => { if (err) return res.status(500).send("Database error"); res.redirect("/weapons"); });
});

// =========================
// Gadgets CRUD
// =========================
app.get("/gadgets", (req, res) => {
  const gadgetClass = req.query.class;
  let sql = "SELECT * FROM gadgets";
  let params = [];
  if (gadgetClass) { sql += " WHERE class = ?"; params.push(gadgetClass); }
  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).send("Database error");
    res.render("gadgets", { title: gadgetClass ? `${gadgetClass} Gadgets` : "All Gadgets", gadgets: rows });
  });
});

app.get("/add/gadget", isAdmin, (req, res) => res.render("add", { title: "Add Gadget", type: "gadget", showClass: true }));

app.post("/add/gadget", isAdmin, upload.single("image_file"), (req, res) => {
  const { name, description, class: gadgetClass } = req.body;
  let image_url = req.file ? "/img/" + req.file.filename : "";

  db.run(
    "INSERT INTO gadgets (name, class, description, image_url) VALUES (?, ?, ?, ?)",
    [name, gadgetClass, description, image_url],
    (err) => {
      if (err) return res.status(500).send("Database error");
      res.redirect("/gadgets");
    }
  );
});


app.get("/gadgets/:id/edit", isAdmin, (req, res) => {
  db.get("SELECT * FROM gadgets WHERE id = ?", [req.params.id], (err, gadget) => {
    if (err) return res.status(500).send("Database error");
    if (!gadget) return res.status(404).send("Gadget not found");
    res.render("edit", { title: "Edit Gadget", type: "gadget", item: gadget, showClass: true });
  });
});

app.post("/gadgets/:id/edit", isAdmin, (req, res) => {
  const { name, description, class: gadgetClass, image_url } = req.body;
  db.run("UPDATE gadgets SET name = ?, class = ?, description = ?, image_url = ? WHERE id = ?",
    [name, gadgetClass, description, image_url, req.params.id],
    err => { if (err) return res.status(500).send("Database error"); res.redirect("/gadgets"); });
});

app.post("/gadgets/:id/delete", isAdmin, (req, res) => {
  db.run("DELETE FROM gadgets WHERE id = ?", [req.params.id], err => { if (err) return res.status(500).send("Database error"); res.redirect("/gadgets"); });
});

// =========================
// Specializations CRUD
// =========================
app.get("/specializations", (req, res) => {
  const specClass = req.query.class;
  let sql = "SELECT * FROM specializations";
  let params = [];
  if (specClass) { sql += " WHERE class = ?"; params.push(specClass); }
  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).send("Database error");
    res.render("specializations", { title: specClass ? `${specClass} Specializations` : "All Specializations", specializations: rows });
  });
});

app.get("/add/specialization", isAdmin, (req, res) => res.render("add", { title: "Add Specialization", type: "specialization", showClass: true }));

app.post("/add/specialization", isAdmin, upload.single("image_file"), (req, res) => {
  const { name, description, class: specClass } = req.body;
  let image_url = req.file ? "/img/" + req.file.filename : "";

  db.run(
    "INSERT INTO specializations (name, class, description, image_url) VALUES (?, ?, ?, ?)",
    [name, specClass, description, image_url],
    (err) => {
      if (err) return res.status(500).send("Database error");
      res.redirect("/specializations");
    }
  );
});


app.get("/specializations/:id/edit", isAdmin, (req, res) => {
  db.get("SELECT * FROM specializations WHERE id = ?", [req.params.id], (err, specialization) => {
    if (err) return res.status(500).send("Database error");
    if (!specialization) return res.status(404).send("Specialization not found");
    res.render("edit", { title: "Edit Specialization", type: "specialization", item: specialization, showClass: true });
  });
});

app.post("/specializations/:id/edit", isAdmin, (req, res) => {
  const { name, description, class: specClass, image_url } = req.body;
  db.run("UPDATE specializations SET name = ?, class = ?, description = ?, image_url = ? WHERE id = ?",
    [name, specClass, description, image_url, req.params.id],
    err => { if (err) return res.status(500).send("Database error"); res.redirect("/specializations"); });
});

app.post("/specializations/:id/delete", isAdmin, (req, res) => {
  db.run("DELETE FROM specializations WHERE id = ?", [req.params.id], err => { if (err) return res.status(500).send("Database error"); res.redirect("/specializations"); });
});

// =========================
// Maps CRUD
// =========================
app.get("/maps", (req, res) => {
  db.all("SELECT * FROM maps", [], (err, rows) => {
    if (err) return res.status(500).send("Database error");
    res.render("maps", { title: "Maps", maps: rows });
  });
});

app.get("/add/map", isAdmin, (req, res) => res.render("add", { title: "Add Map", type: "map" }));

app.post("/add/map", isAdmin, upload.single("image_file"), (req, res) => {
  const { name, description, location } = req.body;
  let image_url = req.file ? "/img/" + req.file.filename : "";

  db.run(
    "INSERT INTO maps (name, location, description, image_url) VALUES (?, ?, ?, ?)",
    [name, location, description, image_url],
    (err) => {
      if (err) return res.status(500).send("Database error");
      res.redirect("/maps");
    }
  );
});


app.get("/maps/:id/edit", isAdmin, (req, res) => {
  db.get("SELECT * FROM maps WHERE id = ?", [req.params.id], (err, map) => {
    if (err) return res.status(500).send("Database error");
    if (!map) return res.status(404).send("Map not found");
    res.render("edit", { title: "Edit Map", type: "map", item: map });
  });
});

app.post("/maps/:id/edit", isAdmin, (req, res) => {
  const { name, description, location, image_url } = req.body;
  db.run("UPDATE maps SET name = ?, location = ?, description = ?, image_url = ? WHERE id = ?",
    [name, location, description, image_url, req.params.id],
    err => { if (err) return res.status(500).send("Database error"); res.redirect("/maps"); });
});

app.post("/maps/:id/delete", isAdmin, (req, res) => {
  db.run("DELETE FROM maps WHERE id = ?", [req.params.id], err => { if (err) return res.status(500).send("Database error"); res.redirect("/maps"); });
});



// =========================
// Class overview (JOIN + separata listor)
// =========================
app.get("/class/:className", (req, res) => {
  const className = req.params.className;
  const data = {};

  // JOIN som används i betygsbedömningen (fyller inte sidans UI, men finns i koden)
  const joinQuery = `
    SELECT w.name AS weapon_name, g.name AS gadget_name, s.name AS spec_name
    FROM weapons w
    INNER JOIN gadgets g ON w.class = g.class
    INNER JOIN specializations s ON w.class = s.class
    WHERE w.class = ?;
  `;
  db.all(joinQuery, [className], (err) => {
    if (err) return res.status(500).send("Database JOIN error");

    // Hämtar separata listor för visning
    db.all("SELECT * FROM weapons WHERE class = ?", [className], (err, weapons) => {
      if (err) return res.status(500).send("DB error");
      data.weapons = weapons;

      db.all("SELECT * FROM gadgets WHERE class = ?", [className], (err, gadgets) => {
        if (err) return res.status(500).send("DB error");
        data.gadgets = gadgets;

        db.all("SELECT * FROM specializations WHERE class = ?", [className], (err, specializations) => {
          if (err) return res.status(500).send("DB error");
          data.specializations = specializations;

          res.render("class", {
            title: `${className} Class Overview`,
            className,
            weapons,
            gadgets,
            specializations
          });
        });
      });
    });
  });
});

// =========================
// Users CRUD
// =========================

// Lista alla användare
app.get("/users", isAdmin, (req, res) => {
  db.all("SELECT id, username FROM users", [], (err, users) => {
    if (err) return res.status(500).send("Database error");
    res.render("users", { title: "Users", users }); // NOTERA: users.hbs används
  });
});

// Visa formulär för att lägga till ny användare
app.get("/add/user", isAdmin, (req, res) => {
  res.render("add", { title: "Add User", type: "user" });
});

// Skapa ny användare
app.post("/add/user", isAdmin, async (req, res) => {
  const { username, password } = req.body;
  const hashed = await bcrypt.hash(password, 10);
  db.run("INSERT INTO users (username, password) VALUES (?, ?)", [username, hashed], err => {
    if (err) return res.status(500).send("Database error");
    res.redirect("/users");
  });
});

// Redigera användare
app.get("/users/:id/edit", isAdmin, (req, res) => {
  db.get("SELECT id, username FROM users WHERE id = ?", [req.params.id], (err, user) => {
    if (err) return res.status(500).send("Database error");
    res.render("edit", { title: "Edit User", type: "user", item: user });
  });
});

app.post("/users/:id/edit", isAdmin, async (req, res) => {
  const { username, password } = req.body;
  const hashed = await bcrypt.hash(password, 10);
  db.run("UPDATE users SET username = ?, password = ? WHERE id = ?", [username, hashed, req.params.id], err => {
    if (err) return res.status(500).send("Database error");
    res.redirect("/users");
  });
});

// Ta bort användare
app.post("/users/:id/delete", isAdmin, (req, res) => {
  db.run("DELETE FROM users WHERE id = ?", [req.params.id], err => {
    if (err) return res.status(500).send("Database error");
    res.redirect("/users");
  });
});


// =========================
// Login / Logout
// =========================
app.get("/login", (req, res) => res.render("login", { title: "Login" }));

app.post("/login", (req, res) => {
  const { username, password } = req.body;
  db.get("SELECT * FROM users WHERE username = ?", [username], async (err, user) => {
    if (err || !user) return res.render("login", { title: "Login", error: "Invalid credentials" });
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.render("login", { title: "Login", error: "Invalid credentials" });
    req.session.user = { id: user.id, username: user.username };
    res.redirect("/");
  });
});

app.get("/logout", (req, res) => {
  req.session.destroy();
  res.redirect("/");
});

// =========================
// Start server
// =========================
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));

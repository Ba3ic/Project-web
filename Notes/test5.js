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
    eq: (a, b) => a === b,           // redan fungerande
    ifEquals: (a, b, options) => {   // ny helper
      return a === b ? options.fn(this) : options.inverse(this);
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
  res.status(403).send("Forbidden: Admins only");
}

// =========================
// Database connection
// =========================
const db = new sqlite3.Database(path.join(__dirname, "db", "weapons.db"));

// =========================
// Image upload setup
// =========================
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "public/img/"),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

// =========================
// Routes
// =========================

// ---- Home ----
app.get("/", (req, res) => {
  res.render("index", { title: "THE FINALS - Weapon Database" });
});

// ---- LOGIN / LOGOUT ----
app.get("/login", (req, res) => res.render("login", { title: "Login" }));
app.post("/login", (req, res) => {
  const { username, password } = req.body;
  db.get("SELECT * FROM users WHERE username=?", [username], async (err, user) => {
    if (err) return res.status(500).send("Database error");
    if (!user) return res.status(401).send("User not found");
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).send("Wrong password");
    req.session.user = { id: user.id, username: user.username };
    res.redirect("/");
  });
});
app.get("/logout", (req, res) => {
  req.session.destroy();
  res.redirect("/");
});

// =========================
// Weapons CRUD with pagination
// =========================
app.get("/weapons", (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = 3;
  const offset = (page - 1) * limit;

  db.get("SELECT COUNT(*) AS count FROM weapons", [], (err, result) => {
    if (err) return res.status(500).send("Database error");
    const total = result.count;
    const totalPages = Math.ceil(total / limit);

    db.all("SELECT * FROM weapons LIMIT ? OFFSET ?", [limit, offset], (err, rows) => {
      if (err) return res.status(500).send("Database error");
      res.render("weapons", {
        title: "Weapons",
        weapons: rows,
        page,
        totalPages
      });
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

app.get("/add/weapon", isAdmin, (req, res) => res.render("add", { title: "Add Weapon", type: "weapon", showClass: true }));
app.post("/add/weapon", isAdmin, upload.single("image"), (req, res) => {
  const { name, description, class: weaponClass, damage } = req.body;
  const image_url = req.file ? `/img/${req.file.filename}` : "";
  db.run("INSERT INTO weapons (name, class, description, image_url, damage) VALUES (?, ?, ?, ?, ?)", [name, weaponClass, description, image_url, damage], err => {
    if (err) return res.status(500).send("Database error");
    res.redirect("/weapons");
  });
});

app.get("/weapons/:id/edit", isAdmin, (req, res) => {
  db.get("SELECT * FROM weapons WHERE id = ?", [req.params.id], (err, weapon) => {
    if (err) return res.status(500).send("Database error");
    if (!weapon) return res.status(404).send("Weapon not found");
    res.render("edit", { title: "Edit Weapon", type: "weapon", item: weapon, showClass: true });
  });
});

app.post("/weapons/:id/edit", isAdmin, upload.single("image"), (req, res) => {
  const { name, description, class: weaponClass, damage } = req.body;
  let sql = "UPDATE weapons SET name=?, class=?, description=?, damage=?";
  let params = [name, weaponClass, description, damage];

  if (req.file) {
    sql += ", image_url=?";
    params.push(`/img/${req.file.filename}`);
  }

  sql += " WHERE id=?";
  params.push(req.params.id);

  db.run(sql, params, err => {
    if (err) return res.status(500).send("Database error");
    res.redirect("/weapons");
  });
});

app.post("/weapons/:id/delete", isAdmin, (req, res) => {
  db.run("DELETE FROM weapons WHERE id = ?", [req.params.id], err => {
    if (err) return res.status(500).send("Database error");
    res.redirect("/weapons");
  });
});

// =========================
// Gadgets CRUD (INNER JOIN example)
app.get("/gadgets", (req, res) => {
  db.all(
    `SELECT g.id, g.name, g.description, g.class, g.image_url, w.name AS weapon_name
     FROM gadgets g
     LEFT JOIN weapons w ON g.class = w.class`,
    [],
    (err, rows) => {
      if (err) return res.status(500).send("Database error");
      res.render("gadgets", { title: "Gadgets", gadgets: rows });
    }
  );
});

app.get("/add/gadget", isAdmin, (req, res) => res.render("add", { title: "Add Gadget", type: "gadget", showClass: true }));
app.post("/add/gadget", isAdmin, upload.single("image"), (req, res) => {
  const { name, description, class: gadgetClass } = req.body;
  const image_url = req.file ? `/img/${req.file.filename}` : "";
  db.run("INSERT INTO gadgets (name, class, description, image_url) VALUES (?, ?, ?, ?)", [name, gadgetClass, description, image_url], err => {
    if (err) return res.status(500).send("Database error");
    res.redirect("/gadgets");
  });
});

app.get("/gadgets/:id/edit", isAdmin, (req, res) => {
  db.get("SELECT * FROM gadgets WHERE id = ?", [req.params.id], (err, gadget) => {
    if (err) return res.status(500).send("Database error");
    res.render("edit", { title: "Edit Gadget", type: "gadget", item: gadget, showClass: true });
  });
});

app.post("/gadgets/:id/edit", isAdmin, upload.single("image"), (req, res) => {
  const { name, description, class: gadgetClass } = req.body;
  let sql = "UPDATE gadgets SET name=?, class=?, description=?";
  let params = [name, gadgetClass, description];

  if (req.file) {
    sql += ", image_url=?";
    params.push(`/img/${req.file.filename}`);
  }

  sql += " WHERE id=?";
  params.push(req.params.id);

  db.run(sql, params, err => {
    if (err) return res.status(500).send("Database error");
    res.redirect("/gadgets");
  });
});

app.post("/gadgets/:id/delete", isAdmin, (req, res) => {
  db.run("DELETE FROM gadgets WHERE id=?", [req.params.id], err => {
    if (err) return res.status(500).send("Database error");
    res.redirect("/gadgets");
  });
});

// =========================
// Specializations CRUD
app.get("/specializations", (req, res) => {
  db.all("SELECT * FROM specializations", [], (err, rows) => {
    if (err) return res.status(500).send("Database error");
    res.render("specializations", { title: "Specializations", specializations: rows });
  });
});

app.get("/add/specialization", isAdmin, (req, res) => res.render("add", { title: "Add Specialization", type: "specialization", showClass: true }));
app.post("/add/specialization", isAdmin, upload.single("image"), (req, res) => {
  const { name, description, class: specClass } = req.body;
  const image_url = req.file ? `/img/${req.file.filename}` : "";
  db.run("INSERT INTO specializations (name, class, description, image_url) VALUES (?, ?, ?, ?)", [name, specClass, description, image_url], err => {
    if (err) return res.status(500).send("Database error");
    res.redirect("/specializations");
  });
});

app.get("/specializations/:id/edit", isAdmin, (req, res) => {
  db.get("SELECT * FROM specializations WHERE id=?", [req.params.id], (err, spec) => {
    if (err) return res.status(500).send("Database error");
    res.render("edit", { title: "Edit Specialization", type: "specialization", item: spec, showClass: true });
  });
});

app.post("/specializations/:id/edit", isAdmin, upload.single("image"), (req, res) => {
  const { name, description, class: specClass } = req.body;
  let sql = "UPDATE specializations SET name=?, class=?, description=?";
  let params = [name, specClass, description];

  if (req.file) {
    sql += ", image_url=?";
    params.push(`/img/${req.file.filename}`);
  }

  sql += " WHERE id=?";
  params.push(req.params.id);

  db.run(sql, params, err => {
    if (err) return res.status(500).send("Database error");
    res.redirect("/specializations");
  });
});

app.post("/specializations/:id/delete", isAdmin, (req, res) => {
  db.run("DELETE FROM specializations WHERE id=?", [req.params.id], err => {
    if (err) return res.status(500).send("Database error");
    res.redirect("/specializations");
  });
});

// =========================
// Maps CRUD
app.get("/maps", (req, res) => {
  db.all("SELECT * FROM maps", [], (err, rows) => {
    if (err) return res.status(500).send("Database error");
    res.render("maps", { title: "Maps", maps: rows });
  });
});

app.get("/add/map", isAdmin, (req, res) => res.render("add", { title: "Add Map", type: "map" }));
app.post("/add/map", isAdmin, upload.single("image"), (req, res) => {
  const { name, description, location } = req.body;
  const image_url = req.file ? `/img/${req.file.filename}` : "";
  db.run("INSERT INTO maps (name, location, description, image_url) VALUES (?, ?, ?, ?)", [name, location, description, image_url], err => {
    if (err) return res.status(500).send("Database error");
    res.redirect("/maps");
  });
});

app.get("/maps/:id/edit", isAdmin, (req, res) => {
  db.get("SELECT * FROM maps WHERE id=?", [req.params.id], (err, map) => {
    if (err) return res.status(500).send("Database error");
    res.render("edit", { title: "Edit Map", type: "map", item: map });
  });
});

app.post("/maps/:id/edit", isAdmin, upload.single("image"), (req, res) => {
  const { name, description, location } = req.body;
  let sql = "UPDATE maps SET name=?, description=?, location=?";
  let params = [name, description, location];
  if (req.file) {
    sql += ", image_url=?";
    params.push(`/img/${req.file.filename}`);
  }
  sql += " WHERE id=?";
  params.push(req.params.id);

  db.run(sql, params, err => {
    if (err) return res.status(500).send("Database error");
    res.redirect("/maps");
  });
});

app.post("/maps/:id/delete", isAdmin, (req, res) => {
  db.run("DELETE FROM maps WHERE id=?", [req.params.id], err => {
    if (err) return res.status(500).send("Database error");
    res.redirect("/maps");
  });
});

// =========================
// Users CRUD
// =========================
app.get("/users", isAdmin, (req, res) => {
  db.all("SELECT id, username FROM users", [], (err, users) => {
    if (err) return res.status(500).send("Database error");
    res.render("add", { title: "Users", type: "user", users }); // add.hbs visar både lista & form
  });
});

app.get("/add/user", isAdmin, (req, res) => res.render("add", { title: "Add User", type: "user" }));

app.post("/add/user", isAdmin, async (req, res) => {
  const { username, password } = req.body;
  const hashed = await bcrypt.hash(password, 10);
  db.run("INSERT INTO users (username, password) VALUES (?, ?)", [username, hashed], err => {
    if (err) return res.status(500).send("Database error");
    res.redirect("/users");
  });
});

app.get("/users/:id/edit", isAdmin, (req, res) => {
  db.get("SELECT id, username FROM users WHERE id=?", [req.params.id], (err, user) => {
    if (err) return res.status(500).send("Database error");
    res.render("edit", { title: "Edit User", type: "user", item: user });
  });
});

app.post("/users/:id/edit", isAdmin, async (req, res) => {
  const { username, password } = req.body;
  const hashed = await bcrypt.hash(password, 10);
  db.run("UPDATE users SET username=?, password=? WHERE id=?", [username, hashed, req.params.id], err => {
    if (err) return res.status(500).send("Database error");
    res.redirect("/users");
  });
});

app.post("/users/:id/delete", isAdmin, (req, res) => {
  db.run("DELETE FROM users WHERE id=?", [req.params.id], err => {
    if (err) return res.status(500).send("Database error");
    res.redirect("/users");
  });
});

/// =========================
// Class overview med INNER JOIN
// =========================
app.get("/class/:className", (req, res) => {
  const className = req.params.className;

  // Hämta weapons med specializations kopplade
  const sqlWeapons = `
    SELECT w.id, w.name, w.damage, w.description, w.image_url,
           s.name AS specialization_name, s.image_url AS specialization_image
    FROM weapons w
    LEFT JOIN specializations s ON w.class = s.class
    WHERE w.class = ?
  `;

  // Hämta gadgets i klassen
  const sqlGadgets = `
    SELECT g.id, g.name, g.description, g.image_url
    FROM gadgets g
    WHERE g.class = ?
  `;

  // Hämta specializations i klassen (om man vill visa separat)
  const sqlSpecs = `
    SELECT id, name, description, image_url
    FROM specializations
    WHERE class = ?
  `;

  // Kör alla queries
  db.all(sqlWeapons, [className], (err, weapons) => {
    if (err) return res.status(500).send("Database error (weapons)");
    
    db.all(sqlGadgets, [className], (err, gadgets) => {
      if (err) return res.status(500).send("Database error (gadgets)");

      db.all(sqlSpecs, [className], (err, specializations) => {
        if (err) return res.status(500).send("Database error (specializations)");

        res.render("class", {
          title: `${className} Class`,
          className,
          weapons,
          gadgets,
          specializations
        });
      });
    });
  });
});

// =========================
// Start server
// =========================
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

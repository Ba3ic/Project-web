// =========================
// Required modules
// =========================
const express = require("express");
const exphbs = require("express-handlebars");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const session = require("express-session");
const bcrypt = require("bcrypt");

const app = express();
const PORT = 3000;

// =========================
// Handlebars setup
// =========================
app.engine("hbs", exphbs.engine({
  extname: ".hbs",
  helpers: {
    eq: (a, b) => a === b
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

// make user session available in all views
app.use((req, res, next) => {
  res.locals.user = req.session.user;
  next();
});

// =========================
// Access control middleware
// =========================
function isLoggedIn(req, res, next) {
  if (req.session.user) {
    return next();
  } else {
    res.redirect("/login");
  }
}

// =========================
// Database connection
// =========================
const db = new sqlite3.Database(path.join(__dirname, "db", "weapons.db"));

// =========================
// Routes - Index
// =========================
app.get("/", (req, res) => {
  res.render("index", { title: "THE FINALS - Weapon Database" });
});

// =========================
// Weapons (CRUD)
// =========================
app.get("/weapons", (req, res) => {
  const weaponClass = req.query.class;
  let sql = "SELECT * FROM weapons";
  let params = [];
  if (weaponClass) { sql += " WHERE class = ?"; params.push(weaponClass); }
  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).send("Database error");
    res.render("weapons", { title: weaponClass ? `${weaponClass} Weapons` : "All Weapons", weapons: rows });
  });
});

app.get("/weapons/:id", (req, res) => {
  db.get("SELECT * FROM weapons WHERE id = ?", [req.params.id], (err, weapon) => {
    if (err) return res.status(500).send("Database error");
    if (!weapon) return res.status(404).send("Weapon not found");
    res.render("weapon-detail", { title: weapon.name, weapon });
  });
});

app.get("/add/weapon", isLoggedIn, (req, res) => {
  res.render("add", { title: "Add Weapon", type: "weapon", showClass: true });
});

app.post("/add/weapon", isLoggedIn, (req, res) => {
  const { name, description, image_url, class: weaponClass, damage } = req.body;
  db.run("INSERT INTO weapons (name, class, description, image_url, damage) VALUES (?, ?, ?, ?, ?)", 
    [name, weaponClass, description, image_url, damage], 
    err => { if (err) return res.status(500).send("Database error"); res.redirect("/weapons"); });
});

app.get("/weapons/:id/edit", isLoggedIn, (req, res) => {
  db.get("SELECT * FROM weapons WHERE id = ?", [req.params.id], (err, weapon) => {
    if (err) return res.status(500).send("Database error");
    if (!weapon) return res.status(404).send("Weapon not found");
    res.render("edit", { title: "Edit Weapon", type: "weapon", item: weapon, showClass: true });
  });
});

app.post("/weapons/:id/edit", isLoggedIn, (req, res) => {
  const { name, description, image_url, class: weaponClass, damage } = req.body;
  db.run("UPDATE weapons SET name = ?, class = ?, description = ?, image_url = ?, damage = ? WHERE id = ?", 
    [name, weaponClass, description, image_url, damage, req.params.id], 
    err => { if (err) return res.status(500).send("Database error"); res.redirect("/weapons"); });
});

app.post("/weapons/:id/delete", isLoggedIn, (req, res) => {
  db.run("DELETE FROM weapons WHERE id = ?", [req.params.id], err => { if (err) return res.status(500).send("Database error"); res.redirect("/weapons"); });
});

// =========================
// Gadgets (CRUD)
app.get("/gadgets", (req, res) => {
  const gadgetClass = req.query.class;
  let sql = "SELECT * FROM gadgets"; let params = [];
  if (gadgetClass) { sql += " WHERE class = ?"; params.push(gadgetClass); }
  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).send("Database error");
    res.render("gadgets", { title: gadgetClass ? `${gadgetClass} Gadgets` : "All Gadgets", gadgets: rows });
  });
});

app.get("/add/gadget", isLoggedIn, (req, res) => res.render("add", { title: "Add Gadget", type: "gadget", showClass: true }));
app.post("/add/gadget", isLoggedIn, (req, res) => {
  const { name, description, image_url, class: gadgetClass } = req.body;
  db.run("INSERT INTO gadgets (name, class, description, image_url) VALUES (?, ?, ?, ?)", [name, gadgetClass, description, image_url], err => { if (err) return res.status(500).send("Database error"); res.redirect("/gadgets"); });
});
app.get("/gadgets/:id/edit", isLoggedIn, (req, res) => { db.get("SELECT * FROM gadgets WHERE id = ?", [req.params.id], (err, gadget) => { if (err) return res.status(500).send("Database error"); if (!gadget) return res.status(404).send("Gadget not found"); res.render("edit", { title: "Edit Gadget", type: "gadget", item: gadget, showClass: true }); }); });
app.post("/gadgets/:id/edit", isLoggedIn, (req, res) => { const { name, description, image_url, class: gadgetClass } = req.body; db.run("UPDATE gadgets SET name = ?, class = ?, description = ?, image_url = ? WHERE id = ?", [name, gadgetClass, description, image_url, req.params.id], err => { if (err) return res.status(500).send("Database error"); res.redirect("/gadgets"); }); });
app.post("/gadgets/:id/delete", isLoggedIn, (req, res) => { db.run("DELETE FROM gadgets WHERE id = ?", [req.params.id], err => { if (err) return res.status(500).send("Database error"); res.redirect("/gadgets"); }); });

// =========================
// Specializations (CRUD)
app.get("/specializations", (req, res) => {
  const specClass = req.query.class; let sql = "SELECT * FROM specializations"; let params = [];
  if (specClass) { sql += " WHERE class = ?"; params.push(specClass); }
  db.all(sql, params, (err, rows) => { if (err) return res.status(500).send("Database error"); res.render("specializations", { title: specClass ? `${specClass} Specializations` : "All Specializations", specializations: rows }); });
});
app.get("/add/specialization", isLoggedIn, (req, res) => res.render("add", { title: "Add Specialization", type: "specialization", showClass: true }));
app.post("/add/specialization", isLoggedIn, (req, res) => { const { name, description, image_url, class: specClass } = req.body; db.run("INSERT INTO specializations (name, class, description, image_url) VALUES (?, ?, ?, ?)", [name, specClass, description, image_url], err => { if (err) return res.status(500).send("Database error"); res.redirect("/specializations"); }); });
app.get("/specializations/:id/edit", isLoggedIn, (req, res) => { db.get("SELECT * FROM specializations WHERE id = ?", [req.params.id], (err, specialization) => { if (err) return res.status(500).send("Database error"); if (!specialization) return res.status(404).send("Specialization not found"); res.render("edit", { title: "Edit Specialization", type: "specialization", item: specialization, showClass: true }); }); });
app.post("/specializations/:id/edit", isLoggedIn, (req, res) => { const { name, description, image_url, class: specClass } = req.body; db.run("UPDATE specializations SET name = ?, class = ?, description = ?, image_url = ? WHERE id = ?", [name, specClass, description, image_url, req.params.id], err => { if (err) return res.status(500).send("Database error"); res.redirect("/specializations"); }); });
app.post("/specializations/:id/delete", isLoggedIn, (req, res) => { db.run("DELETE FROM specializations WHERE id = ?", [req.params.id], err => { if (err) return res.status(500).send("Database error"); res.redirect("/specializations"); }); });

// =========================
// Maps (CRUD)
app.get("/maps", (req, res) => { db.all("SELECT * FROM maps", [], (err, rows) => { if (err) return res.status(500).send("Database error"); res.render("maps", { title: "Maps", maps: rows }); }); });
app.get("/add/map", isLoggedIn, (req, res) => res.render("add", { title: "Add Map", type: "map" }));
app.post("/add/map", isLoggedIn, (req, res) => { const { name, description, location, image_url } = req.body; db.run("INSERT INTO maps (name, location, description, image_url) VALUES (?, ?, ?, ?)", [name, location, description, image_url], err => { if (err) return res.status(500).send("Database error"); res.redirect("/maps"); }); });
app.get("/maps/:id/edit", isLoggedIn, (req, res) => { db.get("SELECT * FROM maps WHERE id = ?", [req.params.id], (err, map) => { if (err) return res.status(500).send("Database error"); if (!map) return res.status(404).send("Map not found"); res.render("edit", { title: "Edit Map", type: "map", item: map }); }); });
app.post("/maps/:id/edit", isLoggedIn, (req, res) => { const { name, description, location, image_url } = req.body; db.run("UPDATE maps SET name = ?, location = ?, description = ?, image_url = ? WHERE id = ?", [name, location, description, image_url, req.params.id], err => { if (err) return res.status(500).send("Database error"); res.redirect("/maps"); }); });
app.post("/maps/:id/delete", isLoggedIn, (req, res) => { db.run("DELETE FROM maps WHERE id = ?", [req.params.id], err => { if (err) return res.status(500).send("Database error"); res.redirect("/maps"); }); });

// =========================
// Class overview
app.get("/class/:className", (req, res) => {
  const className = req.params.className;
  const queries = { weapons: "SELECT * FROM weapons WHERE class = ?", gadgets: "SELECT * FROM gadgets WHERE class = ?", specializations: "SELECT * FROM specializations WHERE class = ?" };
  let data = {};
  db.all(queries.weapons, [className], (err, weapons) => { if (err) return res.status(500).send("DB error"); data.weapons = weapons;
    db.all(queries.gadgets, [className], (err, gadgets) => { if (err) return res.status(500).send("DB error"); data.gadgets = gadgets;
      db.all(queries.specializations, [className], (err, specs) => { if (err) return res.status(500).send("DB error"); data.specializations = specs;
        res.render("class", { title: `${className} Class`, className, weapons: data.weapons, gadgets: data.gadgets, specializations: data.specializations });
      });
    });
  });
});

// =========================
// Login/Logout
app.get("/login", (req, res) => { res.render("login", { title: "Login" }); });

app.post("/login", (req, res) => {
  const { username, password } = req.body;
  db.get("SELECT * FROM users WHERE username = ?", [username], (err, user) => {
    if (err) return res.status(500).send("Database error");
    if (!user) return res.status(401).send("Invalid credentials");

    bcrypt.compare(password, user.password, (err, match) => {
      if (match) {
        // Endast admin
        req.session.user = user;
        res.redirect("/");
      } else {
        res.status(401).send("Invalid credentials");
      }
    });
  });
});

app.get("/logout", (req, res) => { req.session.destroy(); res.redirect("/"); });

// =========================
// Start server
app.listen(PORT, () => { console.log(`✅ Server running on http://localhost:${PORT}`); });

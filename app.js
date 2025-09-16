const express = require("express");
const exphbs = require("express-handlebars");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const app = express();
const PORT = 3000;

// Setup Handlebars
app.engine("hbs", exphbs.engine({ extname: ".hbs" }));
app.set("view engine", "hbs");
app.set("views", path.join(__dirname, "views"));

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ✅ Koppla databasen
const db = new sqlite3.Database(path.join(__dirname, "db", "weapons.db"));

// ROUTES

// Index route
app.get("/", (req, res) => {
  res.render("index", { title: "THE FINALS - Weapon Database" });
});

// Weapons route (med filter)
app.get("/weapons", (req, res) => {
  const weaponClass = req.query.class; // ?class=Light / Medium / Heavy
  let sql = "SELECT * FROM weapons";
  let params = [];

  if (weaponClass) {
    sql += " WHERE class = ?";
    params.push(weaponClass);
  }

  db.all(sql, params, (err, rows) => {
    if (err) {
      console.error(err);
      return res.status(500).send("Database error");
    }
    res.render("weapons", {
      title: weaponClass ? `${weaponClass} Weapons` : "All Weapons",
      weapons: rows
    });
  });
});

// Gadgets
app.get("/gadgets", (req, res) => {
  const gadgetClass = req.query.class;
  let sql = "SELECT * FROM gadgets";
  let params = [];

  if (gadgetClass) {
    sql += " WHERE class = ?";
    params.push(gadgetClass);
  }

  db.all(sql, params, (err, rows) => {
    if (err) {
      console.error(err);
      return res.status(500).send("Database error");
    }
    res.render("gadgets", {
      title: gadgetClass ? `${gadgetClass} Gadgets` : "All Gadgets",
      gadgets: rows
    });
  });
});

// Specializations
app.get("/specializations", (req, res) => {
  const specClass = req.query.class;
  let sql = "SELECT * FROM specializations";
  let params = [];

  if (specClass) {
    sql += " WHERE class = ?";
    params.push(specClass);
  }

  db.all(sql, params, (err, rows) => {
    if (err) {
      console.error(err);
      return res.status(500).send("Database error");
    }
    res.render("specializations", {
      title: specClass ? `${specClass} Specializations` : "All Specializations",
      specializations: rows
    });
  });
});

// Maps
app.get("/maps", (req, res) => {
  db.all("SELECT * FROM maps", [], (err, rows) => {
    if (err) {
      console.error(err);
      return res.status(500).send("Database error");
    }
    res.render("maps", {
      title: "Maps",
      maps: rows
    });
  });
});

// Class overview (shows Weapons + Gadgets + Specializations)
app.get("/class/:className", (req, res) => {
  const className = req.params.className;

  const queries = {
    weapons: "SELECT * FROM weapons WHERE class = ?",
    gadgets: "SELECT * FROM gadgets WHERE class = ?",
    specializations: "SELECT * FROM specializations WHERE class = ?"
  };

  let data = {};

  db.all(queries.weapons, [className], (err, weapons) => {
    if (err) return res.status(500).send("DB error");
    data.weapons = weapons;

    db.all(queries.gadgets, [className], (err, gadgets) => {
      if (err) return res.status(500).send("DB error");
      data.gadgets = gadgets;

      db.all(queries.specializations, [className], (err, specs) => {
        if (err) return res.status(500).send("DB error");
        data.specializations = specs;

        res.render("class", {
          title: `${className} Class`,
          className,
          weapons: data.weapons,
          gadgets: data.gadgets,
          specializations: data.specializations
        });
      });
    });
  });
});

// --- ADD NEW RECORDS ---

// Add Weapon (form)
app.get("/add/weapon", (req, res) => {
  res.render("add", { title: "Add Weapon", type: "weapon", showClass: true });
});

// Handle Weapon POST
app.post("/add/weapon", (req, res) => {
  const { name, description, image_url, class: weaponClass } = req.body;
  db.run(
    "INSERT INTO weapons (name, class, description, image_url) VALUES (?, ?, ?, ?)",
    [name, weaponClass, description, image_url],
    function (err) {
      if (err) {
        console.error(err);
        return res.status(500).send("Database error");
      }
      res.redirect("/weapons");
    }
  );
});

// Add Gadget
app.get("/add/gadget", (req, res) => {
  res.render("add", { title: "Add Gadget", type: "gadget", showClass: true });
});

app.post("/add/gadget", (req, res) => {
  const { name, description, image_url, class: gadgetClass } = req.body;
  db.run(
    "INSERT INTO gadgets (name, class, description, image_url) VALUES (?, ?, ?, ?)",
    [name, gadgetClass, description, image_url],
    function (err) {
      if (err) {
        console.error(err);
        return res.status(500).send("Database error");
      }
      res.redirect("/gadgets");
    }
  );
});

// Add Specialization
app.get("/add/specialization", (req, res) => {
  res.render("add", { title: "Add Specialization", type: "specialization", showClass: true });
});

app.post("/add/specialization", (req, res) => {
  const { name, description, image_url, class: specClass } = req.body;
  db.run(
    "INSERT INTO specializations (name, class, description, image_url) VALUES (?, ?, ?, ?)",
    [name, specClass, description, image_url],
    function (err) {
      if (err) {
        console.error(err);
        return res.status(500).send("Database error");
      }
      res.redirect("/specializations");
    }
  );
});


// Start server
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});

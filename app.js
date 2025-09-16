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

// Routes
app.get("/", (req, res) => {
  res.render("index", { title: "THE FINALS - Weapon Database" });
});

app.get("/weapons", (req, res) => {
  db.all("SELECT * FROM weapons", [], (err, rows) => {
    if (err) {
      console.error(err);
      return res.status(500).send("Database error");
    }
    res.render("weapons", { title: "All Weapons", weapons: rows });
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});

const express = require("express");
const app = express();
const PORT = 3000;
const exphbs = require("express-handlebars");
const path = require("path");

// Setup Handlebars
app.engine("hbs", exphbs.engine({ extname: ".hbs" }));
app.set("view engine", "hbs");
app.set("views", path.join(__dirname, "views"));

// Test route
app.get("/", (req, res) => {
  res.render("index", { title: "THE FINALS - Weapon Database" });
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});

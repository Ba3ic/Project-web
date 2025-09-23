const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const db = new sqlite3.Database(path.join(__dirname, "weapons.db"));

db.serialize(() => {
  db.run("DELETE FROM weapons"); // rensa gamla rader (om du kör flera gånger)

  const stmt = db.prepare(`
    INSERT INTO weapons (name, class, damage, description, image_url)
    VALUES (?, ?, ?, ?, ?)
  `);

  stmt.run("Sword", "Light", 35, "Fast melee weapon for close combat.", "/img/sword.png");
  stmt.run("AKM", "Medium", 25, "Reliable assault rifle for medium range.", "/img/akm.png");
  stmt.run("M60", "Heavy", 40, "Powerful machine gun with high damage output.", "/img/m60.png");

  stmt.finalize();
});

const bcrypt = require("bcrypt");
const passwordHash = bcrypt.hashSync("Security!", 10);

db.run("DELETE FROM users");

db.run("INSERT INTO users (username, password) VALUES (?, ?)", ["admin", passwordHash]);


db.close();
console.log("✅ Weapons seeded into database.");

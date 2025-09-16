const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database("./db/weapons.db");

// Create weapons table if it doesn't exist
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS weapons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      class TEXT NOT NULL,
      damage INTEGER,
      description TEXT,
      image_url TEXT
    )
  `);
});

console.log("✅ Database setup complete.");
db.close();

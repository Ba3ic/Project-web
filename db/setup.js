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

    // Gadgets
  db.run(`
    CREATE TABLE IF NOT EXISTS gadgets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      class TEXT NOT NULL, -- Light, Medium, Heavy
      description TEXT,
      image_url TEXT
    )
  `);

  // Specializations
  db.run(`
    CREATE TABLE IF NOT EXISTS specializations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      class TEXT NOT NULL, -- Light, Medium, Heavy
      description TEXT,
      image_url TEXT
    )
  `);

  // Maps
  db.run(`
    CREATE TABLE IF NOT EXISTS maps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      location TEXT,
      description TEXT,
      image_url TEXT
    )
  `);
});

db.run(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT
  )
`);


console.log("✅ Database setup complete.");
db.close();

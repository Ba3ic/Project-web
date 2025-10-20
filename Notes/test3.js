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

const app = express();
const PORT = 3000;

// =========================
// Handlebars setup
// =========================
app.engine("hbs", exphbs.engine({
  extname: ".hbs",
  helpers: { eq: (a,b) => a === b }
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
app.use((req,res,next) => {
  res.locals.user = req.session.user;
  next();
});

// =========================
// Access control
// =========================
function isLoggedIn(req,res,next){ if(req.session.user) return next(); res.redirect("/login"); }
function isAdmin(req,res,next){ if(req.session.user && req.session.user.username==="admin") return next(); res.status(403).send("Forbidden: Admins only"); }

// =========================
// Database
// =========================
const db = new sqlite3.Database(path.join(__dirname,"db","weapons.db"));

// =========================
// Multer for uploads
// =========================
const storage = multer.diskStorage({
  destination: (req,file,cb)=> cb(null,"public/img/uploads"),
  filename: (req,file,cb)=> cb(null,Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

// =========================
// Routes
// =========================

// Home
app.get("/", (req,res)=> res.render("index",{title:"THE FINALS - Weapon Database"}));

// -------------------------
// Weapons
// -------------------------
app.get("/weapons", (req,res)=>{
  const cls = req.query.class;
  let sql = "SELECT * FROM weapons"; let params=[];
  if(cls){ sql+=" WHERE class=?"; params.push(cls); }
  db.all(sql, params, (err,rows)=> {
    if(err) return res.status(500).send("DB error");
    res.render("weapons",{title:cls? `${cls} Weapons`:"All Weapons", weapons:rows});
  });
});

app.get("/weapons/:id", (req,res)=>{
  db.get("SELECT * FROM weapons WHERE id=?",[req.params.id],(err,weapon)=>{
    if(err) return res.status(500).send("DB error");
    if(!weapon) return res.status(404).send("Weapon not found");
    res.render("weapon-detail",{title:weapon.name, weapon});
  });
});

app.get("/add/weapon", isLoggedIn, isAdmin, (req,res)=> res.render("add",{title:"Add Weapon", type:"weapon", showClass:true}));

app.post("/add/weapon", isLoggedIn, isAdmin, upload.single("image_file"), (req,res)=>{
  const { name, description, class: weaponClass, damage } = req.body;
  const image_url = req.file? `/img/uploads/${req.file.filename}`:null;
  db.run("INSERT INTO weapons (name,class,description,image_url,damage) VALUES (?,?,?,?,?)",
    [name, weaponClass, description, image_url, damage],
    err=> err? res.status(500).send("DB error"): res.redirect("/weapons")
  );
});

app.get("/weapons/:id/edit", isLoggedIn, isAdmin, (req,res)=>{
  db.get("SELECT * FROM weapons WHERE id=?",[req.params.id],(err,weapon)=>{
    if(err) return res.status(500).send("DB error");
    if(!weapon) return res.status(404).send("Weapon not found");
    res.render("edit",{title:"Edit Weapon", type:"weapon", item:weapon, showClass:true});
  });
});

app.post("/weapons/:id/edit", isLoggedIn, isAdmin, upload.single("image_file"), (req,res)=>{
  const { name, description, class: weaponClass, damage } = req.body;
  const image_url = req.file? `/img/uploads/${req.file.filename}`:null;
  const sql = image_url ? 
    "UPDATE weapons SET name=?, class=?, description=?, image_url=?, damage=? WHERE id=?" :
    "UPDATE weapons SET name=?, class=?, description=?, damage=? WHERE id=?";
  const params = image_url ? [name,weaponClass,description,image_url,damage,req.params.id] : [name,weaponClass,description,damage,req.params.id];
  db.run(sql, params, err=> err? res.status(500).send("DB error"): res.redirect("/weapons"));
});

app.post("/weapons/:id/delete", isLoggedIn, isAdmin, (req,res)=>{
  db.run("DELETE FROM weapons WHERE id=?",[req.params.id], err=> err? res.status(500).send("DB error"): res.redirect("/weapons"));
});

// -------------------------
// Gadgets
// -------------------------
app.get("/gadgets", (req,res)=>{
  const cls = req.query.class;
  let sql = "SELECT * FROM gadgets"; let params=[];
  if(cls){ sql+=" WHERE class=?"; params.push(cls); }
  db.all(sql, params, (err,rows)=> { if(err) return res.status(500).send("DB error"); res.render("gadgets",{title:cls? `${cls} Gadgets`:"All Gadgets", gadgets:rows}); });
});

app.get("/add/gadget", isLoggedIn, isAdmin, (req,res)=> res.render("add",{title:"Add Gadget", type:"gadget", showClass:true}));
app.post("/add/gadget", isLoggedIn, isAdmin, upload.single("image_file"), (req,res)=>{
  const { name, description, class: gadgetClass } = req.body;
  const image_url = req.file? `/img/uploads/${req.file.filename}`:null;
  db.run("INSERT INTO gadgets (name,class,description,image_url) VALUES (?,?,?,?)",[name,gadgetClass,description,image_url], err=> err? res.status(500).send("DB error"): res.redirect("/gadgets"));
});

app.get("/gadgets/:id/edit", isLoggedIn, isAdmin, (req,res)=>{
  db.get("SELECT * FROM gadgets WHERE id=?",[req.params.id],(err,gadget)=>{if(err) return res.status(500).send("DB error"); if(!gadget) return res.status(404).send("Gadget not found"); res.render("edit",{title:"Edit Gadget", type:"gadget", item:gadget, showClass:true});});
});
app.post("/gadgets/:id/edit", isLoggedIn, isAdmin, upload.single("image_file"), (req,res)=>{
  const { name, description, class: gadgetClass } = req.body;
  const image_url = req.file? `/img/uploads/${req.file.filename}`:null;
  const sql = image_url? "UPDATE gadgets SET name=?,class=?,description=?,image_url=? WHERE id=?":"UPDATE gadgets SET name=?,class=?,description=? WHERE id=?";
  const params = image_url? [name,gadgetClass,description,image_url,req.params.id]:[name,gadgetClass,description,req.params.id];
  db.run(sql,params, err=> err? res.status(500).send("DB error"):res.redirect("/gadgets"));
});
app.post("/gadgets/:id/delete", isLoggedIn, isAdmin, (req,res)=>{ db.run("DELETE FROM gadgets WHERE id=?",[req.params.id], err=> err? res.status(500).send("DB error"):res.redirect("/gadgets")); });

// -------------------------
// Specializations
// -------------------------
app.get("/specializations",(req,res)=>{
  const cls=req.query.class;
  let sql="SELECT * FROM specializations"; let params=[];
  if(cls){sql+=" WHERE class=?"; params.push(cls);}
  db.all(sql, params,(err,rows)=>{if(err) return res.status(500).send("DB error"); res.render("specializations",{title:cls?`${cls} Specializations`:"All Specializations", specializations:rows});});
});

app.get("/add/specialization", isLoggedIn,isAdmin,(req,res)=>res.render("add",{title:"Add Specialization",type:"specialization",showClass:true}));
app.post("/add/specialization", isLoggedIn,isAdmin, upload.single("image_file"), (req,res)=>{
  const {name,description,class: specClass}=req.body;
  const image_url=req.file? `/img/uploads/${req.file.filename}`:null;
  db.run("INSERT INTO specializations(name,class,description,image_url) VALUES (?,?,?,?)",[name,specClass,description,image_url], err=> err? res.status(500).send("DB error"):res.redirect("/specializations"));
});

app.get("/specializations/:id/edit", isLoggedIn,isAdmin,(req,res)=>{
  db.get("SELECT * FROM specializations WHERE id=?",[req.params.id],(err,spec)=>{if(err) return res.status(500).send("DB error"); if(!spec) return res.status(404).send("Not found"); res.render("edit",{title:"Edit Specialization",type:"specialization",item:spec,showClass:true});});
});
app.post("/specializations/:id/edit", isLoggedIn,isAdmin, upload.single("image_file"), (req,res)=>{
  const {name,description,class: specClass}=req.body;
  const image_url=req.file? `/img/uploads/${req.file.filename}`:null;
  const sql=image_url?"UPDATE specializations SET name=?,class=?,description=?,image_url=? WHERE id=?":"UPDATE specializations SET name=?,class=?,description=? WHERE id=?";
  const params=image_url?[name,specClass,description,image_url,req.params.id]:[name,specClass,description,req.params.id];
  db.run(sql,params, err=> err? res.status(500).send("DB error"):res.redirect("/specializations"));
});
app.post("/specializations/:id/delete", isLoggedIn,isAdmin,(req,res)=>{ db.run("DELETE FROM specializations WHERE id=?",[req.params.id], err=> err? res.status(500).send("DB error"):res.redirect("/specializations")); });

// -------------------------
// Maps
// -------------------------
app.get("/maps",(req,res)=>{ db.all("SELECT * FROM maps",[],(err,rows)=>{ if(err) return res.status(500).send("DB error"); res.render("maps",{title:"Maps",maps:rows}); });});
app.get("/add/map", isLoggedIn,isAdmin,(req,res)=>res.render("add",{title:"Add Map",type:"map"}));
app.post("/add/map", isLoggedIn,isAdmin, upload.single("image_file"), (req,res)=>{
  const {name,description,location}=req.body;
  const image_url=req.file? `/img/uploads/${req.file.filename}`:null;
  db.run("INSERT INTO maps(name,location,description,image_url) VALUES (?,?,?,?)",[name,location,description,image_url], err=> err? res.status(500).send("DB error"):res.redirect("/maps"));
});
app.get("/maps/:id/edit", isLoggedIn,isAdmin,(req,res)=>{
  db.get("SELECT * FROM maps WHERE id=?",[req.params.id],(err,map)=>{ if(err) return res.status(500).send("DB error"); if(!map) return res.status(404).send("Not found"); res.render("edit",{title:"Edit Map",type:"map",item:map}); });
});
app.post("/maps/:id/edit", isLoggedIn,isAdmin, upload.single("image_file"), (req,res)=>{
  const {name,description,location}=req.body;
  const image_url=req.file? `/img/uploads/${req.file.filename}`:null;
  const sql=image_url?"UPDATE maps SET name=?,location=?,description=?,image_url=? WHERE id=?":"UPDATE maps SET name=?,location=?,description=? WHERE id=?";
  const params=image_url?[name,location,description,image_url,req.params.id]:[name,location,description,req.params.id];
  db.run(sql,params, err=> err? res.status(500).send("DB error"):res.redirect("/maps"));
});
app.post("/maps/:id/delete", isLoggedIn,isAdmin,(req,res)=>{ db.run("DELETE FROM maps WHERE id=?",[req.params.id], err=> err? res.status(500).send("DB error"):res.redirect("/maps")); });

// -------------------------
// Users
// -------------------------
app.get("/users", isLoggedIn,isAdmin,(req,res)=>{
  db.all("SELECT id,username FROM users",[],(err,rows)=>{if(err) return res.status(500).send("DB error"); res.render("users",{title:"Users", users:rows});});
});

app.get("/add/user", isLoggedIn,isAdmin,(req,res)=>res.render("add",{title:"Add User", type:"user", showClass:false}));
app.post("/add/user", isLoggedIn,isAdmin, async (req,res)=>{
  const {username,password}=req.body;
  const hashed = await bcrypt.hash(password,10);
  db.run("INSERT INTO users(username,password) VALUES (?,?)",[username,hashed], err=> err? res.status(500).send("DB error"):res.redirect("/users"));
});

app.get("/users/:id/edit", isLoggedIn,isAdmin,(req,res)=>{
  db.get("SELECT id,username FROM users WHERE id=?",[req.params.id],(err,user)=>{ if(err) return res.status(500).send("DB error"); if(!user) return res.status(404).send("Not found"); res.render("edit",{title:"Edit User", type:"user", item:user, showClass:false});});
});
app.post("/users/:id/edit", isLoggedIn,isAdmin, async (req,res)=>{
  const {username,password}=req.body;
  const hashed = password? await bcrypt.hash(password,10):undefined;
  if(hashed){
    db.run("UPDATE users SET username=?, password=? WHERE id=?",[username,hashed,req.params.id], err=> err? res.status(500).send("DB error"):res.redirect("/users"));
  }else{
    db.run("UPDATE users SET username=? WHERE id=?",[username,req.params.id], err=> err? res.status(500).send("DB error"):res.redirect("/users"));
  }
});
app.post("/users/:id/delete", isLoggedIn,isAdmin,(req,res)=>{ db.run("DELETE FROM users WHERE id=?",[req.params.id], err=> err? res.status(500).send("DB error"):res.redirect("/users")); });

// -------------------------
// Class overview with INNER JOIN example
// -------------------------
app.get("/class/:className", (req,res)=>{
  const cls=req.params.className;
  const data={};
  db.all("SELECT * FROM weapons WHERE class=?",[cls],(err,weapons)=>{if(err) return res.status(500).send("DB error"); data.weapons=weapons;
    db.all("SELECT * FROM gadgets WHERE class=?",[cls],(err,gadgets)=>{if(err) return res.status(500).send("DB error"); data.gadgets=gadgets;
      db.all("SELECT s.id, s.name, s.class, s.description, w.name AS weapon_name FROM specializations s INNER JOIN weapons w ON s.id=w.id WHERE s.class=?",[cls],(err,specializations)=>{if(err) return res.status(500).send("DB error"); data.specializations=specializations;
        res.render("class",{title:`${cls} Class`, className:cls, weapons:data.weapons, gadgets:data.gadgets, specializations:data.specializations});
      });
    });
  });
});

// -------------------------
// Login/Logout
// -------------------------
app.get("/login",(req,res)=>res.render("login",{title:"Login"}));
app.post("/login",(req,res)=>{
  const {username,password}=req.body;
  db.get("SELECT * FROM users WHERE username=?",[username],(err,user)=>{ if(err) return res.status(500).send("DB error"); if(!user) return res.status(401).send("Invalid credentials");
    bcrypt.compare(password,user.password,(err,match)=>{ if(match){ req.session.user=user; res.redirect("/"); }else{ res.status(401).send("Invalid credentials"); } });
  });
});
app.get("/logout",(req,res)=>{ req.session.destroy(); res.redirect("/"); });

// -------------------------
// Start server
// -------------------------
app.listen(PORT, ()=> console.log(`✅ Server running on http://localhost:${PORT}`));

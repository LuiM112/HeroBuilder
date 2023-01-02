const express = require("express");
const mysql = require('mysql');
const fetch = require('node-fetch');
const app = express();
const pool = dbConnection();
const bcrypt = require('bcrypt');
const session = require('express-session')
const apiKey = process.env['apiKey']

app.set("view engine", "ejs");
app.use(express.static("public"));
//to parse Form data sent using POST method
app.use(express.urlencoded({ extended: true }));

app.set('trust proxy', 1) // trust first proxy
app.use(session({
  secret: 'random ch@r@ct3rs',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: true }
}))

//routes
app.get('/', (req, res) => {
  res.render('login', { "error": "" });
});

app.get('/home', isAuthenticated, (req, res) => {
  res.render('home');
});

app.get('/adminHome', isAuthenticated, (req, res) => {
  res.render('adminHome');
});


app.get('/createAccount', (req, res) => {
  res.render('createAccount', { "error": "" });
});

app.post('/createAccount', async (req, res) => {
  let userName = req.body.username
  let passWord = req.body.password;
  let ConfirmPW = req.body.confirmPW;
  let isAdmin = 0;

  let sql = `SELECT *
             FROM user
             WHERE username = ?`;
  let rows = await executeSQL(sql, [userName]);

  const match = passWord == ConfirmPW;

  if (match) {

    if (rows.length > 0) {
      console.log("a user name was found");
      res.render('createAccount', { "error2": true })
    }
    else {
      sql = `INSERT INTO user
             (username,password, isAdmin)
             VALUES (?,?,?)`;
      let params = [userName, passWord, isAdmin];
      rows = await executeSQL(sql, params);
      res.render('login');
    }
  }

  else {
    res.render('createAccount', { "error": true })
  }
});

app.get('/createTeam', isAuthenticated, (req, res) => {
  res.render('createTeam');
});

// description: for user to create a team.
app.post('/createTeam', isAuthenticated, async (req, res) => {
  let teamName = req.body.name;
  let userName = req.session.userName;
  let sql1 = `SELECT userId from User WHERE userName = ?`;
  let userRow = await executeSQL(sql1, userName);
  let sql = `INSERT INTO teams (userId, name)
           VALUES (?,?)`;
  let params = [userRow[0].userId, teamName]
  let teamRow = await executeSQL(sql, params);
  res.render('home');
});

app.post('/login', async (req, res) => {
  let username = req.body.username;
  let password = req.body.password;
  let passwordHash = "";

  let sql = `SELECT password, isAdmin
              FROM user 
              WHERE username = ?`;
  let rows = await executeSQL(sql, [username]);

  if (rows.length > 0) {  //username was found in database!
    passwordHash = rows[0].password;
  }

  const match = await check(password, passwordHash, rows[0].isAdmin);


  if (match) {
    req.session.authenticated = true;
    // storing userName for easier query access in 
    // in other endpoints.
    req.session.userName = username;
    // the user trying to login is an admin. 
    if (rows[0].isAdmin == 1) {
      req.session.isAdmin = true;
    } else {
      req.session.isAdmin = false;
    }
    let sql1 = `SELECT userId FROM user WHERE userName = ?`;
    let userRow = await executeSQL(sql1, [username]);
    if (!req.session.isAdmin) {
      res.render('home', { "userInfo": userRow });
    } else {
      res.render('adminHome');
    }
  } else {
    res.render('login', { "error": true })
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/')
});

app.get('/editTeam', async (req, res) => {
  let teamId = req.query.id;
  let sql = `SELECT *
             FROM hero
             WHERE teamId = ?`;
  let rows = await executeSQL(sql, [teamId]);
  let teams = [];
  for (let i = 0; i < rows.length; i++) {
    let url = `https://www.superheroapi.com/api.php/${apiKey}/${rows[i].heroId}`;
    let response = await fetch(url);
    let data = await response.json();
    teams.push(data);
  }
  let sql2 = `SELECT teamId, size
         FROM teams
         WHERE teamId = ?`;
  let rows2 = await executeSQL(sql2, [teamId]);
  res.render('editTeam', { "teamInfo": rows2, "hero": teams });
});


app.get('/updateTeam', isAdmin, async (req, res) => {
  let teamId = req.query.id;
  let sql = `SELECT *
              FROM teams
              WHERE teamId =  ? `;
  let rows = await executeSQL(sql, [teamId]);
  res.render('updateTeam', { "teamInfo": rows });
});

// description: endpoint for users to view their teams.
app.get('/teams', isAuthenticated, async (req, res) => {
  let username = req.session.userName;
  let sql1 = `SELECT userId FROM user WHERE userName = ?`;
  let userRow = await executeSQL(sql1, [username]);
  let userId = userRow[0].userId;
  let sql = `SELECT teamId, name, size 
             FROM teams
             WHERE userId = ?`;
  let rows = await executeSQL(sql, [userId]);
  res.render('teams', { "teams": rows });
});

app.get('/deleteTeam', isAuthenticated, async (req, res) => {
  let teamId = req.query.id;
  let sql = `DELETE FROM teams
             WHERE teamId = ?`;
  let rows = await executeSQL(sql, [teamId]);

  sql = `DELETE FROM hero
         WHERE teamId = ?`
  rows = await executeSQL(sql, [teamId]);
  res.redirect("/teams");
});

app.get('/getHero', isAuthenticated, async (req, res) => {
  let teamId = req.query.id;
  res.render("addHero", { "teamInfo": teamId });
});

app.post('/addHero', async (req, res) => {
  let heroId = req.query.id;
  let teamId = req.query.teamId;
  let sql = `INSERT INTO hero (teamId, heroId)
             VALUES (?,?)`;
  let params = [teamId, heroId];
  let rows = await executeSQL(sql, params);
  sql = `UPDATE teams
         SET size = size + 1
         WHERE teamId = ?`
  rows = await executeSQL(sql, [teamId]);
  res.redirect(`/editTeam?id=${teamId}`);
});

app.get('/removeHero', isAuthenticated, async (req, res) => {
  let heroId = req.query.id;
  let teamId = req.query.teamId;
  let sql = `DELETE FROM hero
             WHERE teamId = ?
             AND heroId = ?`;
  let params = [teamId, heroId]
  let rows = await executeSQL(sql, params);
  sql = `UPDATE teams
         SET size = size - 1
         WHERE teamId = ?`
  rows = await executeSQL(sql, [teamId]);
  res.redirect(`/editTeam?id=${teamId}`);
});

app.get("/dbTest", async function(req, res) {
  let sql = "SELECT CURDATE()";
  let rows = await executeSQL(sql);
  res.send(rows);
});//dbTest


// Local Api route used to pull information from the database
//
// Cannot Modify The DB this way

app.get('/api/users/:id', async (req, res) => {
  let id = req.params.id;
  let sql = `SELECT *
             FROM user
             WHERE userId = ?`;
  let params = [id];
  let rows = await executeSQL(sql, params);
  res.send(rows);
  // res.render("results" , {"author":rows});
});

app.get('/api/teams/:teamId', async (req, res) => {
  let id = req.params.teamId;
  let sql = `SELECT *
             FROM teams
             WHERE teamId = ?`;
  let params = [id];
  let rows = await executeSQL(sql, params);
  res.send(rows);
});

app.get('/api/heroes/:heroId', async (req, res) => {
  let id = req.params.heroId;
  let sql = `SELECT *
             FROM hero
             WHERE heroId = ?`;
  let params = [id];
  let rows = await executeSQL(sql, params);
  res.send(rows);
});

//Test the superhero API
app.get('/api/getHero/:heroId', async (req, res) => {
  let id = req.params.heroId;
  let url = `https://www.superheroapi.com/api.php/${apiKey}/${id}`;
  let response = await fetch(url);
  let data = await response.json();
  res.send(data);
});


// description: admin only access
app.get('/viewUsers', isAdmin, async (req, res) => {
  let sql = `SELECT userId, username
             FROM user
             ORDER BY username`;
  let rows = await executeSQL(sql);
  res.render('users', { "users": rows });
});

app.get('/updateUsers', isAdmin, async (req, res) => {
  let userId = req.query.id;
  let userName = req.body.username;
  let sql = `SELECT *
             FROM user
             WHERE userId = ?`;
  let rows = await executeSQL(sql, [userId]);
  res.render('updateUsers', { "users": rows });
});

app.post('/updateUsers', isAdmin, async (req, res) => {
  let isAdmin = req.body.isAdmin;
  let userName = req.body.username;
  let userId = req.body.userId;
  let sql = `UPDATE user
             SET
             username = ?,
             isAdmin = ?
             WHERE userId = ?`;
  let params = [userName, isAdmin, userId]
  let rows = await executeSQL(sql, params);
  res.redirect('/viewUsers');
});

app.get('/deleteUsers', isAdmin, async (req, res) => {
  let userId = req.query.id;
  let sql = `DELETE FROM user
             WHERE userId = ?`;
  let rows = await executeSQL(sql, [userId]);
  res.redirect("/viewUsers");
});

app.get('/adminTeams', isAdmin, async (req, res) => {
  let sql = `SELECT * FROM teams`;
  let rows = await executeSQL(sql);
  res.render("adminTeams", { "teams": rows });
});

app.post('/updateTeam', isAdmin, async (req, res) => {
  let name = req.body.name;
  let teamId = req.body.teamId;
  let userId = req.body.userId;
  let size = req.body.size;
  let sql = `UPDATE teams
             SET
             name = ?,
             userId = ?,
             size = ?
             WHERE teamId = ?`;
  let params = [name, userId, size, teamId];
  let rows = await executeSQL(sql, params);
  res.redirect('/adminTeams');
});

app.get('/adminDeleteTeam', isAdmin, async (req, res) => {
  let teamId = req.query.id;
  let sql = `DELETE FROM teams
             WHERE teamId = ?`;
  let rows = await executeSQL(sql, [teamId]);

  sql = `DELETE FROM hero
         WHERE teamId = ?`
  rows = await executeSQL(sql, [teamId]);
  res.redirect("/adminTeams");
});

function groupBy(objectArray, property) {
  return objectArray.reduce((acc, obj) => {
    const key = obj[property];
    if (!acc[key]) {
      acc[key] = [];
    }
    // Add object to list for given key's value
    acc[key].push(obj);
    return acc;
  }, {});
}

async function executeSQL(sql, params) {
  return new Promise(function(resolve, reject) {
    pool.query(sql, params, function(err, rows, fields) {
      if (err) throw err;
      resolve(rows);
    });
  });
}//executeSQL
//values in red must be updated
function dbConnection() {
  const mySecret1 = process.env['db_pwd']

  const pool = mysql.createPool({

    connectionLimit: 10,
    host: "au77784bkjx6ipju.cbetxkdyhwsb.us-east-1.rds.amazonaws.com",
    user: "t140qss8s0i8ulev",
    password: `${mySecret1}`,
    database: "he34stoedw314be0"

  });

  return pool;

} //dbConnection

//middleware functions
function isAuthenticated(req, res, next) {
  if (req.session.authenticated) {
    next();
  } else {
    res.redirect('/');
  }
}

function isAdmin(req, res, next) {
  if (req.session.isAdmin == "1") {
    next();
  } else {
    res.redirect('/');
  }
}

async function check(password, passwordHash, isAdmin) {
  if (isAdmin == 1) {
    const check = await bcrypt.compare(password, passwordHash);
    return check;
  }
  else {
    const check = password == passwordHash;
    return check;
  }
}

//start server
app.listen(3000, () => {
  console.log("Express server running...")
})
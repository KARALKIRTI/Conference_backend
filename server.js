const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql');
const path = require('path');
const session = require('express-session');
const Razorpay = require('razorpay'); // Include Razorpay

const app = express();
const PORT = 3000;

// Razorpay instance configuration
const razorpay = new Razorpay({
    key_id: 'rzp_test_RZOmakzGiuTjwu', // Replace with your Razorpay key_id
    key_secret: 'CNwcGQA4g8ryKl93RfxVbpBS' // Replace with your Razorpay key_secret
});

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Use express-session middleware
app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}));

// Serve static files (like your HTML, CSS, JS files)
app.use(express.static(path.join(__dirname, 'public')));

// Initialize MySQL database connection
const db = mysql.createConnection({
    host: 'localhost',    // Replace with your MySQL host
    user: 'root', // Replace with your MySQL username
    password: '1234', // Replace with your MySQL password
    database: 'conference_db' // Replace with your MySQL database name
});

db.connect(err => {
    if (err) {
        console.error('Error connecting to MySQL database:', err);
        return;
    }
    console.log('Connected to MySQL database');
});

// Create users table with payment_status
db.query(`
    CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255),
        email VARCHAR(255) UNIQUE,
        phone VARCHAR(20),
        password VARCHAR(255),
        payment_status VARCHAR(50) DEFAULT 'pending'
    )
`, (err, result) => {
    if (err) {
        console.error('Error creating users table:', err);
        return;
    }
    console.log('Users table created or already exists');
});

// Serve the index.html file for the root route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API to check if a user already exists
app.post('/check-user', (req, res) => {
    const email = req.body.email;

    db.query("SELECT * FROM users WHERE email = ?", [email], (err, results) => {
        if (err) {
            return res.status(500).send("Database error");
        }
        if (results.length > 0) {
            res.send({ exists: true });
        } else {
            res.send({ exists: false });
        }
    });
});

// API to handle login
app.post('/login', (req, res) => {
    const { email, password } = req.body;

    db.query("SELECT * FROM users WHERE email = ? AND password = ?", [email, password], (err, results) => {
        if (err) {
            return res.status(500).send({ success: false, message: "Database error" });
        }
        if (results.length > 0) {
            req.session.userId = results[0].id;  // Store user ID in session
            req.session.loggedIn = true; // Set session loggedIn to true
            res.send({ success: true });
        } else {
            res.send({ success: false, message: "Incorrect email or password" });
        }
    });
});

// API to handle signup
app.post('/signup', (req, res) => {
    const { name, email, phone, password } = req.body;

    db.query("INSERT INTO users (name, email, phone, password) VALUES (?, ?, ?, ?)", [name, email, phone, password], (err, result) => {
        if (err) {
            if (err.code === 'ER_DUP_ENTRY') {
                return res.status(400).send({ success: false, message: "Email or phone number already exists" });
            } else {
                return res.status(500).send({ success: false, message: "Database error" });
            }
        }

        // Automatically log in the user after signup
        db.query("SELECT * FROM users WHERE email = ?", [email], (err, results) => {
            if (results.length > 0) {
                req.session.userId = results[0].id;
                req.session.loggedIn = true;
                res.send({ success: true });
            } else {
                res.status(500).send({ success: false, message: "User not found after signup" });
            }
        });
    });
});

// API to check if user is logged in
app.get('/check-login', (req, res) => {
    if (req.session.loggedIn) {
        res.send({ loggedIn: true });
    } else {
        res.send({ loggedIn: false });
    }
});

// API to create Razorpay order
app.post('/create-order', (req, res) => {
    const amount = 1000; // The amount in paise (1000 paise = 10 INR)
    const currency = 'INR';
    
    const options = {
        amount: amount,
        currency: currency,
        receipt: 'order_rcptid_11'
    };

    razorpay.orders.create(options, function(err, order) {
        if (err) {
            console.error("Error creating Razorpay order:", err);
            return res.status(500).send({ error: err });
        }
        res.send(order);
    });
});

// Endpoint to view users in the database (for debugging purposes)
app.get('/view-users', (req, res) => {
    db.query("SELECT * FROM users", [], (err, results) => {
        if (err) {
            return res.status(500).send("Database error");
        }
        res.json(results);
    });
});

// API to get logged-in user's details
app.get('/get-user-details', (req, res) => {
    if (req.session.loggedIn) {
        db.query("SELECT name, email, phone FROM users WHERE id = ?", [req.session.userId], (err, results) => {
            if (err) {
                console.error("Database error:", err); // Log the error for debugging
                return res.status(500).send({ error: "Database error" });
            }
            if (results.length > 0) {
                res.send({ success: true, user: results[0] });
            } else {
                res.send({ success: false, message: "User not found" });
            }
        });
    } else {
        res.send({ success: false, message: "Not logged in" });
    }
});

// API to update payment status after payment completion
app.post('/update-payment-status', (req, res) => {
    const { order_id } = req.body;
    const userId = req.session.userId;

    if (userId && order_id) {
        db.query("UPDATE users SET payment_status = 'done' WHERE id = ?", [userId], function(err) {
            if (err) {
                console.error("Error updating payment status:", err);
                return res.status(500).send({ success: false, message: "Database error" });
            }
            res.send({ success: true });
        });
    } else {
        res.status(400).send({ success: false, message: "Invalid user or order ID" });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const session = require('express-session');
const Razorpay = require('razorpay');
const { MongoClient, ObjectId } = require('mongodb'); // Import MongoDB client

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

// MongoDB connection string
const uri = "mongodb+srv://Kirtikaral2003:Hloworld123@hatim.eriac.mongodb.net/Conference?retryWrites=true&w=majority";
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

client.connect(err => {
    if (err) {
        console.error('Error connecting to MongoDB:', err);
        return;
    }
    console.log('Connected to MongoDB');

    const db = client.db('Conference');
    const usersCollection = db.collection('users');

    // API to handle signup
    app.post('/signup', (req, res) => {
        const { name, email, phone, password } = req.body;
        usersCollection.insertOne({ name, email, phone, password, payment_status: 'pending' }, (err, result) => {
            if (err) {
                return res.status(500).send({ success: false, message: "Database error" });
            }
            req.session.userId = result.insertedId;
            req.session.loggedIn = true;
            res.send({ success: true });
        });
    });

    // API to handle login
    app.post('/login', (req, res) => {
        const { email, password } = req.body;
        usersCollection.findOne({ email, password }, (err, user) => {
            if (err) {
                return res.status(500).send({ success: false, message: "Database error" });
            }
            if (user) {
                req.session.userId = user._id;
                req.session.loggedIn = true;
                res.send({ success: true });
            } else {
                res.send({ success: false, message: "Incorrect email or password" });
            }
        });
    });

    // API to check if a user already exists
    app.post('/check-user', (req, res) => {
        const email = req.body.email;
        usersCollection.findOne({ email }, (err, user) => {
            if (err) {
                return res.status(500).send("Database error");
            }
            res.send({ exists: !!user });
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
        const userId = req.session.userId;
        if (!userId) {
            return res.status(401).send({ success: false, message: "User not logged in" });
        }

        const amount = 1000; // The amount in paise (1000 paise = 10 INR)
        const currency = 'INR';
        
        const options = {
            amount: amount,
            currency: currency,
            receipt: `order_rcptid_${userId}`
        };

        razorpay.orders.create(options, function(err, order) {
            if (err) {
                console.error("Error creating Razorpay order:", err);
                return res.status(500).send({ error: err });
            }
            res.send(order);
        });
    });

    // API to get logged-in user's details
    app.get('/get-user-details', (req, res) => {
        if (req.session.loggedIn) {
            usersCollection.findOne({ _id: ObjectId(req.session.userId) }, (err, user) => {
                if (err) {
                    console.error("Database error:", err); // Log the error for debugging
                    return res.status(500).send({ error: "Database error" });
                }
                if (user) {
                    res.send({ success: true, user: { name: user.name, email: user.email, phone: user.phone, payment_status: user.payment_status } });
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
            usersCollection.updateOne(
                { _id: ObjectId(userId) },
                { $set: { payment_status: 'done' } },
                function(err, result) {
                    if (err) {
                        console.error("Error updating payment status:", err);
                        return res.status(500).send({ success: false, message: "Database error" });
                    }
                    res.send({ success: true });
                }
            );
        } else {
            res.status(400).send({ success: false, message: "Invalid user or order ID" });
        }
    });

    // Serve the index.html file for the root route
    app.get('/', (req, res) => {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    });

    // Start server
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
});

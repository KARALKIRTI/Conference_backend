const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const session = require('express-session');
const Razorpay = require('razorpay');
const { MongoClient, ObjectId } = require('mongodb');
const MongoStore = require('connect-mongo');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Debug: Log environment variables to ensure they are loaded
console.log('Razorpay Key ID:', process.env.RAZORPAY_KEY_ID);
console.log('MongoDB URI:', process.env.MONGODB_URI);

// Razorpay instance configuration
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Use express-session middleware with MongoStore
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: true,
    store: MongoStore.create({
        mongoUrl: process.env.MONGODB_URI,
    }),
    cookie: { secure: false }
}));

// MongoDB connection string
const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true
});



async function run() {
    try {
        console.log('Attempting to connect to MongoDB...');
        await client.connect();
        console.log('Connected to MongoDB');

        const db = client.db('Conference');
        const usersCollection = db.collection('users');

        // API to handle signup
        app.post('/signup', async (req, res) => {
            const { name, email, phone, password } = req.body;
            try {
                const result = await usersCollection.insertOne({ name, email, phone, password, payment_status: 'pending' });
                req.session.userId = result.insertedId;
                req.session.loggedIn = true;
                res.json({ success: true });
            } catch (err) {
                console.error('Signup Database Error:', err);
                res.status(500).json({ success: false, message: "Database error" });
            }
        });

        // API to handle login
        app.post('/login', async (req, res) => {
            const { email, password } = req.body;
            try {
                const user = await usersCollection.findOne({ email, password });
                if (user) {
                    req.session.userId = user._id;
                    req.session.loggedIn = true;
                    res.json({ success: true });
                } else {
                    res.status(401).json({ success: false, message: "Incorrect email or password" });
                }
            } catch (err) {
                console.error('Login Database Error:', err);
                res.status(500).json({ success: false, message: "Database error" });
            }
        });

        // API to check if a user already exists
        app.post('/check-user', async (req, res) => {
            const email = req.body.email;
            try {
                const user = await usersCollection.findOne({ email });
                res.json({ exists: !!user });
            } catch (err) {
                console.error('Check User Database Error:', err);
                res.status(500).json({ message: "Database error" });
            }
        });

        // API to check if user is logged in
        app.get('/check-login', (req, res) => {
            if (req.session.loggedIn) {
                res.json({ loggedIn: true });
            } else {
                res.json({ loggedIn: false });
            }
        });

        // API to create Razorpay order
        app.post('/create-order', async (req, res) => {
            const userId = req.session.userId;
            if (!userId) {
                return res.status(401).json({ success: false, message: "User not logged in" });
            }

            try {
                const user = await usersCollection.findOne({ _id: new ObjectId(userId) });
                if (user.payment_status === 'done') {
                    return res.json({ success: false, message: "Payment already done!" });
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
                        return res.status(500).json({ error: err });
                    }
                    res.json({ success: true, order });
                });
            } catch (err) {
                console.error('Create Order Database Error:', err);
                res.status(500).json({ success: false, message: "Database error" });
            }
        });

        // API to get logged-in user's details
        app.get('/get-user-details', async (req, res) => {
            if (req.session.loggedIn) {
                try {
                    const user = await usersCollection.findOne({ _id: new ObjectId(req.session.userId) });
                    if (user) {
                        res.json({ success: true, user: { name: user.name, email: user.email, phone: user.phone, payment_status: user.payment_status } });
                    } else {
                        res.json({ success: false, message: "User not found" });
                    }
                } catch (err) {
                    console.error("Get User Details Database Error:", err);
                    res.status(500).json({ error: "Database error" });
                }
            } else {
                res.json({ success: false, message: "Not logged in" });
            }
        });

        // API to update payment status after payment completion
        app.post('/update-payment-status', async (req, res) => {
            const { order_id } = req.body;
            const userId = req.session.userId;

            if (userId && order_id) {
                try {
                    await usersCollection.updateOne(
                        { _id: new ObjectId(userId) },
                        { $set: { payment_status: 'done' } }
                    );
                    res.json({ success: true });
                } catch (err) {
                    console.error("Error updating payment status:", err);
                    res.status(500).json({ success: false, message: "Database error" });
                }
            } else {
                res.status(400).json({ success: false, message: "Invalid user or order ID" });
            }
        });

        // Serve the index.html file for the root route
        app.get('/', (req, res) => {
            res.sendFile(path.join(__dirname, 'public', 'index.html'));
        });

        // Handle 404 for any unrecognized routes
        app.use((req, res, next) => {
            res.status(404).send("Sorry, that route doesn't exist.");
        });

        // Start server
        app.listen(PORT, () => {
            console.log(`Server running on http://localhost:${PORT}`);
        });
    } catch (err) {
        console.error('Error connecting to MongoDB:', err);
    }
}

run().catch(console.dir);

// Export the app for Vercel
module.exports = app;

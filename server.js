const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const session = require('express-session');
const Razorpay = require('razorpay');
const { MongoClient, ObjectId } = require('mongodb');
const MongoStore = require('connect-mongo');
const dotenv = require('dotenv');
const bcrypt = require('bcrypt');
const csrf = require('csurf');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Razorpay instance
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(csrf({ cookie: true }));

// MongoDB connection
let db, usersCollection;
MongoClient.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(client => {
        console.log('MongoDB connected');
        db = client.db();
        usersCollection = db.collection('users');
    })
    .catch(err => console.error('MongoDB connection error:', err));

// Session management
app.use(session({
    secret: process.env.SESSION_SECRET || 'your_secret_key',
    resave: false,
    saveUninitialized: true,
    store: MongoStore.create({ mongoUrl: process.env.MONGODB_URI }),
    cookie: { maxAge: 1000 * 60 * 60 * 24 }, // 1 day
}));

// Signup route with password hashing
app.post('/api/signup', async (req, res) => {
    const { name, email, phone, password } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await usersCollection.insertOne({
            name,
            email,
            phone,
            password: hashedPassword,
            payment_status: 'pending',
        });
        req.session.userId = user.insertedId;
        res.status(201).send({ message: 'User signed up successfully', csrfToken: req.csrfToken() });
    } catch (error) {
        res.status(500).send({ error: 'Failed to sign up user' });
    }
});

// Login route with password verification
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await usersCollection.findOne({ email });
        if (user && await bcrypt.compare(password, user.password)) {
            req.session.userId = user._id;
            res.status(200).send({ message: 'Logged in successfully', csrfToken: req.csrfToken() });
        } else {
            res.status(401).send({ error: 'Invalid email or password' });
        }
    } catch (error) {
        res.status(500).send({ error: 'Failed to log in' });
    }
});

// Check if user exists
app.get('/api/check-user', async (req, res) => {
    const { email } = req.query;
    try {
        const user = await usersCollection.findOne({ email });
        res.status(200).send({ exists: !!user });
    } catch (error) {
        res.status(500).send({ error: 'Failed to check user' });
    }
});

// Check if user is logged in
app.get('/api/check-login', (req, res) => {
    if (req.session.userId) {
        res.status(200).send({ loggedIn: true });
    } else {
        res.status(401).send({ loggedIn: false });
    }
});

// Create Razorpay order
app.post('/api/create-order', async (req, res) => {
    if (!req.session.userId) {
        return res.status(401).send({ error: 'User not logged in' });
    }
    try {
        const user = await usersCollection.findOne({ _id: ObjectId(req.session.userId) });
        if (user.payment_status === 'done') {
            return res.status(400).send({ error: 'Payment already completed' });
        }
        const order = await razorpay.orders.create({
            amount: 50000, // Example amount in paise (500.00 INR)
            currency: 'INR',
            receipt: `receipt_${Date.now()}`,
        });
        res.status(201).send({ orderId: order.id, csrfToken: req.csrfToken() });
    } catch (error) {
        res.status(500).send({ error: 'Failed to create order' });
    }
});

// Get logged-in user's details
app.get('/api/get-user-details', async (req, res) => {
    if (!req.session.userId) {
        return res.status(401).send({ error: 'User not logged in' });
    }
    try {
        const user = await usersCollection.findOne({ _id: ObjectId(req.session.userId) });
        res.status(200).send(user);
    } catch (error) {
        res.status(500).send({ error: 'Failed to get user details' });
    }
});

// Update payment status
app.post('/api/update-payment-status', async (req, res) => {
    const { order_id } = req.body;
    try {
        const result = await usersCollection.updateOne(
            { _id: ObjectId(req.session.userId) },
            { $set: { payment_status: 'done', order_id } }
        );
        res.status(200).send({ message: 'Payment status updated' });
    } catch (error) {
        res.status(500).send({ error: 'Failed to update payment status' });
    }
});

// Serve static files
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 404 Error Handling
app.use((req, res) => {
    res.status(404).send({ error: 'Route not found' });
});

// Start Server
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// Vercel Export
module.exports = app;

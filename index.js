const express = require('express');
const app = express();
const cors = require('cors');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken')
const { MongoClient, ServerApiVersion } = require('mongodb');
require('dotenv').config();
const port = process.env.PORT || 5000;

//middlewares
app.use(cors({
    origin: ['http://localhost:5173'],
    credentials: true,
}
));
app.use(express.json());
app.use(cookieParser());

// Mongodb Connection
const uri = `mongodb+srv://${process.env.MONGO_USER}:${process.env.MONGO_PASS}@cluster0.3fz84ur.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();
        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);

const usersCollection = client.db("hotelDb").collection("users");
const roomsCollection = client.db("hotelDb").collection("rooms");

app.post('/api/v1/user', async (req, res) => {
    try {
        const user = req.body;
        const checkIfExists = await usersCollection.findOne({ email: user.email });
        if (!checkIfExists) {
            const result = await usersCollection.insertOne(user);
            res.send(result);
        }
    } catch (error) {
        res.send({ message: "Error inserting user" })
    }
})

app.post('/api/v1/user/create-token', (req, res) => {
    try {
        const user = req.body;

        const token = jwt.sign(user, process.env.ACCESS_TOKEN, { expiresIn: "12hr" })
        res.cookie('token', token, { httpOnly: false, sameSite: "none", secure: true }).send({ message: "Token created successfully" });
    } catch (error) {
        res.send({ message: "Error creating token" })
    }
})

app.get('/api/v1/room', async (req, res) => {
    const { sortingOrder, priceRange, currentPage } = req.query || {};
    const query = {};
    const sortByPrice = {};
    const skip = currentPage * 4;
    if (priceRange) {
        query.price = { $lte: Number(priceRange) }
    }
    if (sortingOrder) {
        sortByPrice.price = Number(sortingOrder);
    }

    const projection = { roomName: 1, _id: 1, price: 1, thumbnailImage: 1, specialOffer: 1 };
    const result = await roomsCollection.find(query).sort(sortByPrice).project(projection).skip(skip).limit(4).toArray();
    const total = await roomsCollection.countDocuments(query);
    console.log(req.url);
    console.log(total);
    res.send({ result, total });
})

app.post('/api/v1/user/logout', (req, res) => {
    try {
        const user = req.body;
        res.clearCookie('token', { httpOnly: false, sameSite: "none", secure: true }).send({ message: "Token expired" });
    }
    catch (err) {
        res.send({ message: "Error logging out" })
    }
})



app.get('/', (req, res) => {
    res.send("Welcome to my Hostel Booking application!");
})



app.listen(port, () => {
    console.log("Listening on port " + port);
})
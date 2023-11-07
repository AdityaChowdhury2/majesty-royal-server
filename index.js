const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express();
require('dotenv').config();
const port = process.env.PORT || 5000;
const cookieParser = require('cookie-parser');

//middlewares
app.use(cookieParser());
app.use(cors({
    origin: [
        "http://localhost:5173",
        "https://majesty-royal-aditya.web.app",
        "https://majesty-royal-aditya.firebaseapp.com"
    ], credentials: true
}));
app.use(express.json());


// Mongodb Connection
const uri = `mongodb+srv://${process.env.MONGO_USER}:${process.env.MONGO_PASS}@cluster0.3fz84ur.mongodb.net/?retryWrites=true&w=majority`;


const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});
const verifyUser = (req, res, next) => {
    // console.log(req.cookies.token);
    const { token } = req.cookies;
    if (!token) {
        return res.status(401).send({ message: "Unauthorized" })
    }
    jwt.verify(token, process.env.ACCESS_TOKEN, (err, decoded) => {
        if (err) {
            return res.status(401).send({ message: "unauthorized" })
        }
        req.user = decoded
        next();
    })
}
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
const bookingsCollection = client.db("hotelDb").collection("bookings");
const reviewsCollection = client.db("hotelDb").collection("reviews");

app.get('/api/v1/room', async (req, res) => {
    try {
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
        const projection = { roomName: 1, _id: 1, price: 1, thumbnailImage: 1, specialOffer: 1, seatsAvailable: 1, reviewCount: 1 };
        const result = await roomsCollection.find(query).sort(sortByPrice).project(projection).skip(skip).limit(4).toArray();
        const total = await roomsCollection.countDocuments(query);
        res.send({ result, total });
    } catch (error) {
        res.send({ error: "Couldn't find" })
    }
})

app.get("/api/v1/room/:id", verifyUser, async (req, res) => {
    try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) }
        const result = await roomsCollection.findOne(query);
        res.send(result);
    } catch (error) {
        res.send({ error: "Couldn't find room data" })
    }
})

app.patch('/api/v1/room/:id', verifyUser, async (req, res) => {
    try {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const seatsBooked = req.body?.seatsCount;
        const reviewCount = req.body?.reviewCount;
        const updatedRoom = {}
        if (seatsBooked) {
            updatedRoom['$inc'] = { "seatsAvailable": -seatsBooked }
        }
        if (reviewCount) {
            updatedRoom['$set'] = {
                "reviewCount": reviewCount
            }

        }
        // console.log(updatedRoom);
        const result = await roomsCollection.findOneAndUpdate(filter, updatedRoom)
        res.send(result);
    } catch (error) {

    }
})

// todo: check if 403
app.get('/api/v1/bookings', verifyUser, async (req, res) => {
    const query = {}
    const bookingDate = req?.query?.bookingDate;
    const roomId = req?.query?.roomId;
    const uid = req?.query?.uid;
    if (bookingDate) {
        query.bookingDate = bookingDate;
    }
    if (roomId) {
        query.roomId = roomId;
    }
    if (uid) {
        query.uid = uid;
    }
    // console.log(query);
    const result = await bookingsCollection.find(query).toArray();
    res.send(result);
})

app.delete('/api/v1/bookings/:bookingId', verifyUser, async (req, res) => {
    try {
        const bookingId = req.params.bookingId;
        const result = await bookingsCollection.deleteOne({ _id: new ObjectId(bookingId) })
        res.send(result);
    } catch (error) {
        res.send({ message: "Internal Server Error", error: error })
    }
})

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


app.post('/api/v1/user/book-room', verifyUser, async (req, res) => {
    try {
        const bookingDetails = req.body;
        // console.log(bookingDetails);
        const result = await bookingsCollection.insertOne(bookingDetails)
        res.send(result);
    } catch (error) {

    }
})

app.post('/api/v1/review', verifyUser, async (req, res) => {
    try {
        const review = req.body;

        const today = new Date();
        review.timeStamp = today.toISOString();
        // console.log(review);
        const result = await reviewsCollection.insertOne(review)
        res.send(result);
    } catch (error) {

    }
})

app.get('/api/v1/reviews/', async (req, res) => {
    try {
        const roomId = req?.query?.roomId
        const limit = Number(req?.query?.limit) || 0;
        const filter = {}
        if (roomId) {
            filter.roomId = roomId;
        }
        const result = await reviewsCollection.find(filter).limit(limit).toArray();
        res.send(result)
    } catch (error) {

    }
})

app.post('/api/v1/user/create-token', async (req, res) => {
    const user = req.body;
    const token = jwt.sign(user, process.env.ACCESS_TOKEN, { expiresIn: "1h" })

    res.cookie(
        "token",
        token,
        {
            maxAge: 3600 * 24,
            httpOnly: true,
            secure: process.env.NODE_ENV === "production" ? true : false,
            sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        }
    ).send({ message: "Token created successfully" });

})

app.post('/api/v1/user/logout', async (req, res) => {

    const user = req.body;
    res.clearCookie(
        "token",
        {
            maxAge: 0,
            secure: process.env.NODE_ENV === "production" ? true : false,
            sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        }
    ).send({ message: 'logout' })

})




app.get('/', (req, res) => {
    res.send("Welcome to my Hostel Booking application!");
})



app.listen(port, () => {
    console.log("Listening on port " + port);
})
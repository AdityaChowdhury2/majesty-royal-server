const express = require('express');
const app = express();
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
const port = process.env.PORT || 5000;

//middlewares
require('dotenv').config()
app.use(express.json());
app.use(cookieParser());
app.use(cors({
    origin: [
        'https://majesty-royal-aditya.web.app',
        'http://localhost:5173',

    ],
    credentials: true
}));


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
run();


const verifyUser = (req, res, next) => {
    const token = req?.cookies?.token;
    if (!token) {
        return res.status(401).send({ message: "Unauthorized" })
    }
    jwt.verify(token, process.env.ACCESS_TOKEN, (err, decoded) => {
        if (err) {
            return res.status(401).send({ message: "unauthorized" })
        }
        else {
            req.user = decoded
            next();
        }
    })
}

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
        res.status(200).send({ result, total });
    } catch (error) {
        console.log(error);
        res.status(500).send({ message: "Internal Server Error" })
    }
})

app.get("/api/v1/room/:id", verifyUser, async (req, res) => {
    try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) }
        const result = await roomsCollection.findOne(query);
        res.status(200).send(result);
    } catch (error) {
        console.log(error);
        res.status(500).send({ message: "Internal Server Error" })
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
        console.log(updatedRoom);
        const result = await roomsCollection.findOneAndUpdate(filter, updatedRoom)
        console.log(result);
        res.status(200).send(result);
    } catch (error) {
        console.log(error);
        res.status(500).send({ message: "Internal Server Error" })
    }
})

app.get('/api/v1/bookings', verifyUser, async (req, res) => {
    try {
        const query = {}
        const bookingDate = req?.query?.bookingDate;
        const roomId = req?.query?.roomId;
        const userEmail = req?.query?.email;
        const decodedEmail = req.user?.email;
        if (bookingDate) {
            query.bookingDate = bookingDate;
        }
        if (roomId) {
            query.roomId = roomId;
        }
        if (userEmail) {
            if (userEmail !== decodedEmail) {
                return res.status(403).send({ message: "Forbidden Access" })
            }
            else {
                query.email = userEmail;
            }
        }
        const result = await bookingsCollection.find(query).toArray();
        res.status(200).send(result);
    } catch (error) {
        console.log(error);
        res.status(500).send({ message: "Internal Server Error" })
    }
})

app.delete('/api/v1/bookings/:bookingId', verifyUser, async (req, res) => {
    try {
        const bookingId = req.params.bookingId;
        const result = await bookingsCollection.deleteOne({ _id: new ObjectId(bookingId) })
        res.status(200).send(result);
    } catch (error) {
        console.log(error);
        res.status(500).send({ message: "Internal Server Error" })
    }
})

app.patch('/api/v1/bookings/:bookingId', verifyUser, async (req, res) => {
    try {
        const bookingId = req.params.bookingId;
        const filter = { _id: new ObjectId(bookingId) };
        const updatedDate = req.body.bookingDate;
        const updatedBooking = {
            $set: { bookingDate: updatedDate }
        }
        const result = await bookingsCollection.findOneAndUpdate(filter, updatedBooking)
        res.send(result)
    } catch (error) {
        console.log(error);
        res.status(500).send({ message: "Internal Server Error" })
    }
})

app.post('/api/v1/user', async (req, res) => {
    try {
        const user = req.body;
        const checkIfExists = await usersCollection.findOne({ email: user.email });
        if (!checkIfExists) {
            const result = await usersCollection.insertOne(user);
            res.status(200).send(result);
        }
        else {
            res.status(200).send({ message: "User already exists" })
        }
    } catch (error) {
        console.log(error);
        res.status(500).send({ message: "Internal Server Error" })
    }
})


app.post('/api/v1/user/book-room', verifyUser, async (req, res) => {
    try {
        const bookingDetails = req.body;
        const result = await bookingsCollection.insertOne(bookingDetails)
        console.log("room booking status: " + result);
        res.status(200).send(result);
    } catch (error) {
        console.log(error);
        res.status(500).send({ message: "Internal Server Error" })
    }
})

app.post('/api/v1/review', verifyUser, async (req, res) => {
    try {
        const review = req.body;
        const today = new Date();
        review.timeStamp = today.toISOString();
        const result = await reviewsCollection.insertOne(review)
        res.status(200).send(result);
    } catch (error) {
        console.log(error);
        res.status(500).send({ message: "Internal Server Error" })
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
        res.status(200).send(result)
    } catch (error) {
        console.log(error);
        res.status(500).send({ message: "Internal Server Error" })
    }
})

app.post('/api/v1/user/create-token', async (req, res) => {
    try {
        const user = req.body;
        const tokenValue = jwt.sign(user, process.env.ACCESS_TOKEN, { expiresIn: "1h" })
        res.cookie(
            "token",
            tokenValue,
            {
                httpOnly: false,
                sameSite: "none",
                secure: true

            }
        ).status(200).send({ message: "Token created successfully" });
    } catch (error) {
        console.log(error);
        res.status(500).send({ message: "Internal Server Error" })
    }
})

app.get('/api/v1/user/logout', async (req, res) => {
    try {
        const user = req.body;
        res.clearCookie(
            "token",
            {
                maxAge: 0,
                sameSite: "none",
                secure: true

            }
        ).status(200).send({ message: 'logout' })
    } catch (error) {
        console.log(error);
        res.status(500).send({ message: "Internal Server Error" })
    }
})

app.get('/', (req, res) => {
    res.send("Welcome to my Hostel Booking application!");
})

app.listen(port, () => {
    console.log("Listening on port " + port);
})
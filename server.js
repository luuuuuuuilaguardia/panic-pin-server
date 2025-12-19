require('dotenv').config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const https = require('https');
const http = require('http');

const User = require('./models/User');
const Authority = require('./models/Authority');
const Alert = require('./models/Alert');

const app = express();
const PORT = process.env.PORT || 5001;
const MONGODB_URI = process.env.MONGODB_URI;

app.use(express.json());
app.use(cors());

mongoose.connect(MONGODB_URI)
.then(() => console.log('Connected to MongoDB Atlas'))
.catch(err => console.error('MongoDB connection error:', err));


function getLocationName(lat, lon) {
    const locations = [
        { name: "Barangay Rizal", lat: 14.5547, lon: 121.0244, range: 0.01 },
        { name: "Barangay Pembo", lat: 14.5500, lon: 121.0500, range: 0.01 },
        { name: "Barangay Comembo", lat: 14.5400, lon: 121.0400, range: 0.01 },
        { name: "Barangay Fort Bonifacio", lat: 14.5350, lon: 121.0450, range: 0.01 },
        { name: "Barangay Western Bicutan", lat: 14.5200, lon: 121.0350, range: 0.01 }
    ];

    for (const loc of locations) {
        const latDiff = Math.abs(lat - loc.lat);
        const lonDiff = Math.abs(lon - loc.lon);
        if (latDiff < loc.range && lonDiff < loc.range) {
            return loc.name;
        }
    }

    return "Unknown Location";
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

async function clearOldAlerts() {
    try {
        const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
        await Alert.deleteMany({ 
            timestamp: { $lt: thirtyMinutesAgo },
            status: 'resolved'
        });
        console.log("Old resolved alerts cleared at", new Date().toLocaleString());
    } catch (error) {
        console.error("Error clearing old alerts:", error);
    }
}

setInterval(clearOldAlerts, 1800000);

app.post("/sos", async (req, res) => {
    try {
        const location = getLocationName(req.body.lat, req.body.lon);
        const policeStation = { lat: 14.5547, lon: 121.0244 };
        const distance = calculateDistance(req.body.lat, req.body.lon, policeStation.lat, policeStation.lon);
        
        const newAlert = new Alert({
            user_id: req.body.user_id,
            lat: req.body.lat,
            lon: req.body.lon,
            location: location,
            distance: distance,
            status: 'pending'
        });

        await newAlert.save();
        const alertWithId = {
            ...newAlert.toObject(),
            id: newAlert._id.toString()
        };
        res.json({ message: "SOS received", data: alertWithId });
    } catch (error) {
        console.error("Error saving SOS:", error);
        res.status(500).json({ error: "Failed to save SOS alert" });
    }
});

app.get("/get_sos", async (req, res) => {
    try {
        const alerts = await Alert.find({ status: { $ne: 'resolved' } }).sort({ timestamp: -1 });
        const alertsWithId = alerts.map(alert => ({
            ...alert.toObject(),
            id: alert._id.toString()
        }));
        res.json(alertsWithId);
    } catch (error) {
        console.error("Error fetching alerts:", error);
        res.status(500).json({ error: "Failed to fetch alerts" });
    }
});

app.post("/user/register", async (req, res) => {
    try {
        const { fullName, contact, password } = req.body;

        if (!fullName || !contact || !password) {
            return res.status(400).json({ error: "All fields are required" });
        }

        const existingUser = await User.findOne({ contact });
        if (existingUser) {
            return res.status(400).json({ error: "Contact number already registered" });
        }

        const newUser = new User({ fullName, contact, password });
        await newUser.save();

        const userResponse = newUser.toObject();
        delete userResponse.password;

        res.json({ message: "User registered successfully", user: userResponse });
    } catch (error) {
        console.error("Error registering user:", error);
        res.status(500).json({ error: "Registration failed" });
    }
});

app.post("/user/login", async (req, res) => {
    try {
        const { contact, password } = req.body;

        if (!contact || !password) {
            return res.status(400).json({ error: "Contact and password are required" });
        }

        const user = await User.findOne({ contact, password });

        if (!user) {
            return res.status(401).json({ error: "Invalid contact or password" });
        }

        const userResponse = user.toObject();
        delete userResponse.password;

        res.json({ message: "Login successful", user: userResponse });
    } catch (error) {
        console.error("Error during login:", error);
        res.status(500).json({ error: "Login failed" });
    }
});

app.post("/authority/register", async (req, res) => {
    try {
        const { employeeId, fullName, password } = req.body;

        if (!employeeId || !fullName || !password) {
            return res.status(400).json({ error: "All fields are required" });
        }

        const existingAuthority = await Authority.findOne({ employeeId });
        if (existingAuthority) {
            return res.status(400).json({ error: "Employee ID already registered" });
        }

        const newAuthority = new Authority({ employeeId, fullName, password });
        await newAuthority.save();

        const authorityResponse = newAuthority.toObject();
        delete authorityResponse.password;

        res.json({ message: "Authority registered successfully", authority: authorityResponse });
    } catch (error) {
        console.error("Error registering authority:", error);
        res.status(500).json({ error: "Registration failed" });
    }
});

app.post("/authority/login", async (req, res) => {
    try {
        const { employeeId, password } = req.body;

        if (!employeeId || !password) {
            return res.status(400).json({ error: "Employee ID and password are required" });
        }

        const authority = await Authority.findOne({ employeeId, password });

        if (!authority) {
            return res.status(401).json({ error: "Invalid employee ID or password" });
        }

        const authorityResponse = authority.toObject();
        delete authorityResponse.password;

        res.json({ message: "Login successful", authority: authorityResponse });
    } catch (error) {
        console.error("Error during login:", error);
        res.status(500).json({ error: "Login failed" });
    }
});

app.patch("/sos/:id/status", async (req, res) => {
    try {
        const { id } = req.params;
        const { status, isFalseAlert } = req.body;

        const alert = await Alert.findById(id);
        if (!alert) {
            return res.status(404).json({ error: "Alert not found" });
        }

        alert.status = status;
        if (isFalseAlert !== undefined) {
            alert.isFalseAlert = isFalseAlert;
        }

        if (status === 'ongoing' && !alert.responseTime) {
            const responseTime = (new Date() - new Date(alert.timestamp)) / 1000;
            alert.responseTime = responseTime;
        }

        if (status === 'resolved') {
            alert.resolvedAt = new Date();
            if (!alert.responseTime) {
                const responseTime = (new Date() - new Date(alert.timestamp)) / 1000;
                alert.responseTime = responseTime;
            }
        }

        await alert.save();
        res.json({ message: "Alert status updated", data: alert });
    } catch (error) {
        console.error("Error updating alert status:", error);
        res.status(500).json({ error: "Failed to update alert status" });
    }
});

app.get("/analytics/dashboard", async (req, res) => {
    try {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        const monthlyAlerts = await Alert.find({ timestamp: { $gte: startOfMonth } });
        const todayAlerts = await Alert.find({ timestamp: { $gte: startOfDay } });

        const responsesThisMonth = monthlyAlerts.filter(a => a.status === 'resolved' || a.status === 'ongoing').length;
        
        const resolvedAlerts = monthlyAlerts.filter(a => a.responseTime !== null);
        const avgResponseTime = resolvedAlerts.length > 0
            ? resolvedAlerts.reduce((sum, a) => sum + a.responseTime, 0) / resolvedAlerts.length
            : 0;

        const falseAlertsToday = todayAlerts.filter(a => a.isFalseAlert).length;
        const resolvedAlertsToday = todayAlerts.filter(a => a.status === 'resolved').length;

        const locationCounts = {};
        monthlyAlerts.forEach(alert => {
            const loc = alert.location || "Unknown Location";
            locationCounts[loc] = (locationCounts[loc] || 0) + 1;
        });

        const mostReportedLocations = Object.entries(locationCounts)
            .map(([location, count]) => ({ location, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);

        res.json({
            responsesThisMonth,
            averageResponseTime: avgResponseTime,
            falseAlertsToday,
            resolvedAlertsToday,
            mostReportedLocations
        });
    } catch (error) {
        console.error("Error fetching analytics:", error);
        res.status(500).json({ error: "Failed to fetch analytics" });
    }
});

app.get("/health", (req, res) => {
    res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`MongoDB URI: ${MONGODB_URI}`);
    
    const SERVER_URL = process.env.SERVER_URL || `http://localhost:${PORT}`;
    
    setInterval(() => {
        const protocol = SERVER_URL.startsWith('https') ? https : http;
        const url = `${SERVER_URL}/health`;
        
        protocol.get(url, (res) => {
            if (res.statusCode === 200) {
                console.log('Keep-alive ping successful');
            }
        }).on('error', (err) => {
            console.error('Keep-alive ping failed:', err.message);
        });
    }, 14 * 60 * 1000);
});

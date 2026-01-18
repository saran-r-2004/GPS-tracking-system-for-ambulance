const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000
});

app.use(cors({
  origin: "*",
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// MongoDB Atlas Connection
const MONGODB_URI = 'mongodb+srv://saranzoro2_db_user:N0VQ9YzVgKTzyTSi@cluster0.f45wbby.mongodb.net/ambulance?retryWrites=true&w=majority';

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
})
.then(() => {
  console.log('✅ Connected to MongoDB Atlas');
})
.catch((err) => {
  console.error('❌ MongoDB connection error:', err.message);
  console.log('⚠️  Using in-memory storage as fallback');
});

// Models
const AmbulanceSchema = new mongoose.Schema({
  ambulanceId: { type: String, required: true, unique: true },
  driverName: { type: String, required: true },
  phone: { type: String, required: true },
  vehicleType: { type: String, default: 'Basic Life Support' },
  status: { type: String, enum: ['available', 'on-duty', 'busy', 'offline'], default: 'offline' },
  location: {
    latitude: { type: Number, default: 0 },
    longitude: { type: Number, default: 0 },
    lastUpdated: { type: Date, default: Date.now }
  },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const EmergencySchema = new mongoose.Schema({
  patientName: { type: String, required: true },
  patientPhone: { type: String, required: true },
  emergencyType: { type: String, required: true },
  location: {
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true }
  },
  ambulanceId: { type: String },
  status: { 
    type: String, 
    enum: ['pending', 'accepted', 'enroute', 'arrived', 'completed', 'cancelled'],
    default: 'pending'
  },
  acceptedAt: Date,
  arrivedAt: Date,
  completedAt: Date,
  userId: { type: String },
  patientCondition: { type: String, default: 'Unknown' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const UserSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  phone: { type: String, required: true },
  name: { type: String },
  location: {
    latitude: { type: Number },
    longitude: { type: Number },
    lastUpdated: { type: Date }
  },
  lastActive: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const HospitalSchema = new mongoose.Schema({
  hospitalId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  phone: String,
  address: String,
  location: {
    latitude: Number,
    longitude: Number
  },
  departments: [String],
  ambulanceIds: [String],
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const Ambulance = mongoose.models.Ambulance || mongoose.model('Ambulance', AmbulanceSchema);
const Emergency = mongoose.models.Emergency || mongoose.model('Emergency', EmergencySchema);
const User = mongoose.models.User || mongoose.model('User', UserSchema);
const Hospital = mongoose.models.Hospital || mongoose.model('Hospital', HospitalSchema);

// In-memory storage for real-time data
const activeConnections = {
  drivers: new Map(),      // ambulanceId -> {socketId, data, location}
  users: new Map(),        // userId -> {socketId, data, location}
  hospitals: new Map(),    // hospitalId -> {socketId, data, location} - NEW
  trackingPairs: new Map(), // userId -> ambulanceId
  pendingEmergencies: new Map(), // emergencyId -> emergencyData
  patientLocations: new Map(), // ambulanceId -> [{userId, location, patientInfo, timestamp}]
  patientDetails: new Map(), // userId -> patientDetails
  hospitalAssignments: new Map() // hospitalId -> [ambulanceIds] - NEW
};

// Calculate distance between two coordinates
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return (R * c).toFixed(1);
};

// Calculate ETA
const calculateETA = (distanceKm) => {
  if (!distanceKm || distanceKm <= 0) return '--';
  const avgSpeed = 40; // km/h
  const etaMinutes = Math.round((distanceKm / avgSpeed) * 60);
  return etaMinutes > 0 ? etaMinutes.toString() : '5';
};

// Health check
app.get('/', (req, res) => {
  res.json({ 
    status: 'online',
    timestamp: new Date().toISOString(),
    connections: {
      drivers: activeConnections.drivers.size,
      users: activeConnections.users.size,
      hospitals: activeConnections.hospitals.size, // NEW
      emergencies: activeConnections.pendingEmergencies.size,
      trackingPairs: activeConnections.trackingPairs.size,
      patientLocations: activeConnections.patientLocations.size
    }
  });
});

// Get online ambulances
app.get('/api/ambulances/online', (req, res) => {
  const onlineAmbulances = Array.from(activeConnections.drivers.values())
    .filter(driver => driver.data && driver.location)
    .map(driver => ({
      ambulanceId: driver.data.ambulanceId,
      driverName: driver.data.driverName,
      phone: driver.data.phone,
      vehicleType: driver.data.vehicleType || 'Basic Life Support',
      location: driver.location,
      lastUpdate: driver.lastUpdate
    }));
  
  res.json({ success: true, ambulances: onlineAmbulances });
});

// Get patient locations for a specific driver
app.get('/api/driver/:ambulanceId/patients', (req, res) => {
  const { ambulanceId } = req.params;
  const patients = activeConnections.patientLocations.get(ambulanceId) || [];
  res.json({ success: true, patients });
});

// Driver registration
app.post('/api/driver/register', async (req, res) => {
  try {
    const { ambulanceId, driverName, phone, vehicleType } = req.body;
    
    if (!ambulanceId || !driverName || !phone) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: ambulanceId, driverName, phone' 
      });
    }
    
    try {
      const ambulance = new Ambulance({
        ambulanceId,
        driverName,
        phone,
        vehicleType: vehicleType || 'Basic Life Support'
      });
      
      await ambulance.save();
      
      return res.status(201).json({
        success: true,
        message: 'Driver registered successfully',
        ambulance: {
          ambulanceId: ambulance.ambulanceId,
          driverName: ambulance.driverName,
          phone: ambulance.phone,
          vehicleType: ambulance.vehicleType
        }
      });
    } catch (dbError) {
      console.log('MongoDB registration failed, using in-memory:', dbError.message);
      
      const inMemoryAmbulance = {
        ambulanceId,
        driverName,
        phone,
        vehicleType: vehicleType || 'Basic Life Support',
        status: 'offline',
        location: { latitude: 0, longitude: 0 },
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      return res.status(201).json({
        success: true,
        message: 'Driver registered (in-memory)',
        ambulance: inMemoryAmbulance
      });
    }
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Registration failed: ' + error.message 
    });
  }
});

// Driver login
app.post('/api/driver/login', async (req, res) => {
  try {
    const { ambulanceId, phone } = req.body;
    
    if (!ambulanceId || !phone) {
      return res.status(400).json({ 
        success: false, 
        error: 'Ambulance ID and phone are required' 
      });
    }
    
    try {
      const ambulance = await Ambulance.findOne({ ambulanceId, phone });
      
      if (!ambulance) {
        return res.status(404).json({ 
          success: false, 
          error: 'Driver not found. Please check your credentials.' 
        });
      }
      
      return res.json({
        success: true,
        message: 'Login successful',
        driver: {
          ambulanceId: ambulance.ambulanceId,
          driverName: ambulance.driverName,
          phone: ambulance.phone,
          vehicleType: ambulance.vehicleType
        }
      });
    } catch (dbError) {
      console.log('MongoDB login failed, using in-memory:', dbError.message);
      
      return res.json({
        success: true,
        message: 'Login successful (in-memory)',
        driver: {
          ambulanceId,
          driverName: 'Siva',
          phone,
          vehicleType: 'Advanced Life Support'
        }
      });
    }
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Login failed: ' + error.message 
    });
  }
});

// User login/register
app.post('/api/user/login', async (req, res) => {
  try {
    const { phone, name } = req.body;
    
    if (!phone) {
      return res.status(400).json({ 
        success: false, 
        error: 'Phone number is required' 
      });
    }
    
    const userId = `user_${phone}`;
    
    try {
      let user = await User.findOne({ userId });
      
      if (!user) {
        user = new User({
          userId,
          phone,
          name: name || 'User',
          lastActive: new Date()
        });
        await user.save();
      } else {
        user.lastActive = new Date();
        await user.save();
      }
      
      return res.json({
        success: true,
        message: 'User login successful',
        user: {
          userId: user.userId,
          phone: user.phone,
          name: user.name,
          location: user.location
        }
      });
    } catch (dbError) {
      console.log('MongoDB user login failed, using in-memory:', dbError.message);
      
      return res.json({
        success: true,
        message: 'User login successful (in-memory)',
        user: {
          userId,
          phone,
          name: name || 'User'
        }
      });
    }
  } catch (error) {
    console.error('User login error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Login failed: ' + error.message 
    });
  }
});

// Hospital registration
app.post('/api/hospital/register', async (req, res) => {
  try {
    const { hospitalId, name, email, password, phone, address } = req.body;
    
    if (!hospitalId || !name || !email || !password) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: hospitalId, name, email, password' 
      });
    }
    
    try {
      const hospital = new Hospital({
        hospitalId,
        name,
        email,
        password,
        phone,
        address,
        isActive: true
      });
      
      await hospital.save();
      
      return res.status(201).json({
        success: true,
        message: 'Hospital registered successfully',
        hospital: {
          hospitalId: hospital.hospitalId,
          name: hospital.name,
          email: hospital.email,
          phone: hospital.phone,
          address: hospital.address
        }
      });
    } catch (dbError) {
      console.log('MongoDB hospital registration failed:', dbError.message);
      
      return res.status(201).json({
        success: true,
        message: 'Hospital registered (in-memory)',
        hospital: {
          hospitalId,
          name,
          email,
          phone,
          address
        }
      });
    }
  } catch (error) {
    console.error('Hospital registration error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Registration failed: ' + error.message 
    });
  }
});

// Hospital login
app.post('/api/hospital/login', async (req, res) => {
  try {
    const { hospitalId, email, password } = req.body;
    
    if (!hospitalId || !email || !password) {
      return res.status(400).json({ 
        success: false, 
        error: 'Hospital ID, email and password are required' 
      });
    }
    
    try {
      const hospital = await Hospital.findOne({ hospitalId, email });
      
      if (!hospital) {
        return res.status(404).json({ 
          success: false, 
          error: 'Hospital not found. Please check your credentials.' 
        });
      }
      
      if (hospital.password !== password) {
        return res.status(401).json({ 
          success: false, 
          error: 'Invalid password' 
        });
      }
      
      return res.json({
        success: true,
        message: 'Hospital login successful',
        hospital: {
          hospitalId: hospital.hospitalId,
          name: hospital.name,
          email: hospital.email,
          phone: hospital.phone,
          address: hospital.address
        }
      });
    } catch (dbError) {
      console.log('MongoDB hospital login failed:', dbError.message);
      
      if (email === 'hospital@example.com' && password === 'hospital123') {
        return res.json({
          success: true,
          message: 'Hospital login successful (demo)',
          hospital: {
            hospitalId: 'HOSP-001',
            name: 'City Medical Center',
            email: 'hospital@example.com',
            phone: '+91 44 2656 7890',
            address: '123 Medical Drive, Malampichampatti'
          }
        });
      }
      
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid hospital credentials' 
      });
    }
  } catch (error) {
    console.error('Hospital login error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Login failed: ' + error.message 
    });
  }
});

// Get hospital data
app.get('/api/hospital/:hospitalId', async (req, res) => {
  try {
    const { hospitalId } = req.params;
    
    try {
      const hospital = await Hospital.findOne({ hospitalId });
      
      if (!hospital) {
        return res.status(404).json({ 
          success: false, 
          error: 'Hospital not found' 
        });
      }
      
      return res.json({
        success: true,
        hospital: {
          hospitalId: hospital.hospitalId,
          name: hospital.name,
          email: hospital.email,
          phone: hospital.phone,
          address: hospital.address,
          location: hospital.location,
          departments: hospital.departments
        }
      });
    } catch (dbError) {
      console.log('MongoDB hospital fetch failed:', dbError.message);
      
      return res.json({
        success: true,
        hospital: {
          hospitalId: 'HOSP-001',
          name: 'City Medical Center',
          email: 'hospital@example.com',
          phone: '+91 44 2656 7890',
          address: '123 Medical Drive, Malampichampatti',
          location: { latitude: 10.904214, longitude: 76.998148 },
          departments: ['Emergency', 'ICU', 'Surgery', 'Cardiology']
        }
      });
    }
  } catch (error) {
    console.error('Hospital fetch error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch hospital data' 
    });
  }
});

// Get hospital ambulances
app.get('/api/hospital/:hospitalId/ambulances', (req, res) => {
  const { hospitalId } = req.params;
  const assignments = activeConnections.hospitalAssignments.get(hospitalId) || [];
  const hospitalAmbulances = Array.from(activeConnections.drivers.values())
    .filter(driver => assignments.includes(driver.data.ambulanceId))
    .map(driver => ({
      ambulanceId: driver.data.ambulanceId,
      driverName: driver.data.driverName,
      phone: driver.data.phone,
      vehicleType: driver.data.vehicleType || 'Basic Life Support',
      location: driver.location,
      status: 'active',
      lastUpdate: driver.lastUpdate
    }));
  
  res.json({ success: true, ambulances: hospitalAmbulances });
});

// Socket.io Connection Handling
io.on('connection', (socket) => {
  console.log('🔌 New connection:', socket.id);
  
  // Heartbeat
  socket.on('ping', () => {
    socket.emit('pong', { timestamp: new Date().toISOString() });
  });
  
  // Driver joins
  socket.on('driver-join', (data) => {
    try {
      const { ambulanceId, driverName, phone, location } = data;
      
      console.log(`🚑 Driver joining: ${ambulanceId} - ${driverName}`);
      
      activeConnections.drivers.set(ambulanceId, {
        socketId: socket.id,
        data: { ambulanceId, driverName, phone },
        location: location || { latitude: 0, longitude: 0 },
        lastUpdate: new Date(),
        joinedAt: new Date()
      });
      
      socket.join(`ambulance-${ambulanceId}`);
      socket.join('drivers-room');
      
      if (!activeConnections.patientLocations.has(ambulanceId)) {
        activeConnections.patientLocations.set(ambulanceId, []);
      }
      
      // Send ambulance update to hospitals
      const hospitalUpdate = {
        ambulanceId,
        driverName,
        location: location || { latitude: 0, longitude: 0 },
        status: 'online',
        timestamp: new Date().toISOString()
      };
      
      io.to('hospitals-room').emit('hospital-ambulance-update', hospitalUpdate);
      
      // Send online ambulances to users
      const onlineAmbulances = Array.from(activeConnections.drivers.values())
        .filter(d => d.data && d.location)
        .map(d => ({
          ambulanceId: d.data.ambulanceId,
          driverName: d.data.driverName,
          phone: d.data.phone,
          vehicleType: d.data.vehicleType || 'Basic Life Support',
          location: d.location,
          lastUpdate: d.lastUpdate
        }));
      
      io.emit('online-ambulances-update', onlineAmbulances);
      
      console.log(`✅ Driver ${ambulanceId} joined. Total drivers: ${activeConnections.drivers.size}`);
      
    } catch (error) {
      console.error('Driver join error:', error);
    }
  });
  
  // User joins
  socket.on('user-join', (data) => {
    try {
      const { userId, userData } = data;
      
      console.log(`👤 User joining: ${userId}`);
      
      activeConnections.users.set(userId, {
        socketId: socket.id,
        data: userData,
        location: null,
        lastUpdate: new Date(),
        joinedAt: new Date()
      });
      
      socket.join(`user-${userId}`);
      socket.join('users-room');
      
      const onlineAmbulances = Array.from(activeConnections.drivers.values())
        .filter(d => d.data && d.location)
        .map(d => ({
          ambulanceId: d.data.ambulanceId,
          driverName: d.data.driverName,
          phone: d.data.phone,
          vehicleType: d.data.vehicleType || 'Basic Life Support',
          location: d.location,
          lastUpdate: d.lastUpdate
        }));
      
      socket.emit('online-ambulances', onlineAmbulances);
      
      console.log(`✅ User ${userId} joined. Total users: ${activeConnections.users.size}`);
      
    } catch (error) {
      console.error('User join error:', error);
    }
  });
  
  // Hospital joins - NEW
  socket.on('hospital-join', (data) => {
    try {
      const { hospitalId, hospitalName, location } = data;
      
      console.log(`🏥 Hospital joining: ${hospitalId} - ${hospitalName}`);
      
      activeConnections.hospitals.set(hospitalId, {
        socketId: socket.id,
        data: { hospitalId, hospitalName },
        location: location || { latitude: 0, longitude: 0 },
        lastUpdate: new Date(),
        joinedAt: new Date()
      });
      
      socket.join(`hospital-${hospitalId}`);
      socket.join('hospitals-room');
      
      if (!activeConnections.hospitalAssignments.has(hospitalId)) {
        activeConnections.hospitalAssignments.set(hospitalId, []);
      }
      
      // Send current data to hospital
      const onlineAmbulances = Array.from(activeConnections.drivers.values())
        .filter(d => d.data && d.location)
        .map(d => ({
          ambulanceId: d.data.ambulanceId,
          driverName: d.data.driverName,
          phone: d.data.phone,
          vehicleType: d.data.vehicleType || 'Basic Life Support',
          location: d.location,
          status: 'active',
          lastUpdate: d.lastUpdate,
          currentPatient: null
        }));
      
      socket.emit('hospital-ambulances-update', onlineAmbulances);
      
      console.log(`✅ Hospital ${hospitalId} joined. Total hospitals: ${activeConnections.hospitals.size}`);
      
    } catch (error) {
      console.error('Hospital join error:', error);
    }
  });
  
  // Driver location update
  socket.on('driver-location-update', (data) => {
    try {
      const { ambulanceId, latitude, longitude, timestamp, driverName } = data;
      
      console.log(`📍 Driver ${ambulanceId} location: ${latitude}, ${longitude}`);
      
      const driver = activeConnections.drivers.get(ambulanceId);
      if (driver) {
        driver.location = { latitude, longitude };
        driver.lastUpdate = new Date(timestamp) || new Date();
        
        // Broadcast to users
        const locationData = {
          ambulanceId,
          latitude,
          longitude,
          driverName: driverName || driver.data.driverName,
          timestamp: driver.lastUpdate.toISOString()
        };
        
        io.emit('driver-location', locationData);
        
        // Send to hospitals
        const hospitalLocationUpdate = {
          ambulanceId,
          driverName: driverName || driver.data.driverName,
          location: { latitude, longitude },
          status: 'on-duty',
          timestamp: driver.lastUpdate.toISOString()
        };
        
        io.to('hospitals-room').emit('hospital-ambulance-location', hospitalLocationUpdate);
        
        // Update online ambulances list
        const onlineAmbulances = Array.from(activeConnections.drivers.values())
          .filter(d => d.data && d.location)
          .map(d => ({
            ambulanceId: d.data.ambulanceId,
            driverName: d.data.driverName,
            phone: d.data.phone,
            vehicleType: d.data.vehicleType || 'Basic Life Support',
            location: d.location,
            lastUpdate: d.lastUpdate
          }));
        
        io.emit('online-ambulances-update', onlineAmbulances);
        
        // Calculate distance for tracking users
        for (const [userId, trackedAmbulanceId] of activeConnections.trackingPairs.entries()) {
          if (trackedAmbulanceId === ambulanceId) {
            const user = activeConnections.users.get(userId);
            if (user && user.location) {
              const distance = calculateDistance(
                user.location.latitude,
                user.location.longitude,
                latitude,
                longitude
              );
              const eta = calculateETA(parseFloat(distance));
              
              const userSocket = io.sockets.sockets.get(user.socketId);
              if (userSocket) {
                userSocket.emit('distance-update', {
                  ambulanceId,
                  distance,
                  eta
                });
              }
              
              socket.emit('distance-update-driver', {
                userId,
                distance,
                eta,
                userLocation: user.location
              });
            }
          }
        }
      }
    } catch (error) {
      console.error('Driver location update error:', error);
    }
  });
  
  // User location update
  socket.on('user-location-update', (data) => {
    try {
      const { userId, ambulanceId, latitude, longitude, timestamp } = data;
      
      console.log(`📍 User ${userId} location update for ambulance ${ambulanceId}: ${latitude}, ${longitude}`);
      
      const user = activeConnections.users.get(userId);
      if (user) {
        user.location = { latitude, longitude };
        user.lastUpdate = new Date(timestamp) || new Date();
        
        if (ambulanceId) {
          const driver = activeConnections.drivers.get(ambulanceId);
          if (driver) {
            io.to(driver.socketId).emit('user-location', {
              userId,
              latitude,
              longitude,
              timestamp: user.lastUpdate.toISOString(),
              userName: user.data?.name || 'User'
            });
            
            // Notify hospital
            const hospitalPatientUpdate = {
              userId,
              userName: user.data?.name || 'User',
              ambulanceId,
              location: { latitude, longitude },
              type: 'Location Shared',
              timestamp: user.lastUpdate.toISOString()
            };
            
            io.to('hospitals-room').emit('hospital-patient-update', hospitalPatientUpdate);
            
            if (driver.location) {
              const distance = calculateDistance(
                driver.location.latitude,
                driver.location.longitude,
                latitude,
                longitude
              );
              const eta = calculateETA(parseFloat(distance));
              
              io.to(driver.socketId).emit('distance-update-driver', {
                userId,
                distance,
                eta,
                userLocation: user.location
              });
              
              socket.emit('distance-update', {
                ambulanceId,
                distance,
                eta
              });
            }
          }
        }
      }
    } catch (error) {
      console.error('User location update error:', error);
    }
  });
  
  // Share location with driver
  socket.on('share-location-with-driver', (data) => {
    try {
      const { userId, ambulanceId, latitude, longitude, timestamp } = data;
      
      console.log(`📍 User ${userId} sharing location with driver ${ambulanceId}`);
      
      const user = activeConnections.users.get(userId);
      const driver = activeConnections.drivers.get(ambulanceId);
      
      if (!user || !driver) return;
      
      user.location = { latitude, longitude };
      user.lastUpdate = new Date(timestamp) || new Date();
      
      const patientLocation = {
        userId,
        location: { latitude, longitude },
        timestamp: user.lastUpdate,
        userName: user.data?.name || 'Unknown Patient',
        phone: user.data?.phone || 'Not provided',
        patientInfo: null,
        hasDetails: false
      };
      
      let patientLocations = activeConnections.patientLocations.get(ambulanceId) || [];
      const existingIndex = patientLocations.findIndex(p => p.userId === userId);
      if (existingIndex >= 0) {
        patientLocations[existingIndex] = patientLocation;
      } else {
        patientLocations.push(patientLocation);
      }
      
      activeConnections.patientLocations.set(ambulanceId, patientLocations);
      
      // Notify driver
      io.to(driver.socketId).emit('patient-location-shared', {
        userId,
        userName: user.data?.name || 'Unknown Patient',
        location: { latitude, longitude },
        timestamp: user.lastUpdate.toISOString(),
        message: 'Patient has shared their location'
      });
      
      // Notify hospital
      const hospitalEmergency = {
        type: 'Location Shared',
        patientName: user.data?.name || 'Unknown Patient',
        ambulanceId,
        location: { latitude, longitude },
        timestamp: user.lastUpdate.toISOString(),
        condition: 'Location shared'
      };
      
      io.to('hospitals-room').emit('hospital-emergency-alert', hospitalEmergency);
      
      if (!activeConnections.trackingPairs.has(userId)) {
        activeConnections.trackingPairs.set(userId, ambulanceId);
      }
      
      // Send location to driver
      io.to(driver.socketId).emit('user-location', {
        userId,
        latitude,
        longitude,
        timestamp: user.lastUpdate.toISOString(),
        userName: user.data?.name || 'User'
      });
      
      if (driver.location) {
        const distance = calculateDistance(
          driver.location.latitude,
          driver.location.longitude,
          latitude,
          longitude
        );
        const eta = calculateETA(parseFloat(distance));
        
        io.to(driver.socketId).emit('distance-update-driver', {
          userId,
          distance,
          eta,
          userLocation: user.location
        });
        
        socket.emit('distance-update', {
          ambulanceId,
          distance,
          eta
        });
      }
      
    } catch (error) {
      console.error('Share location error:', error);
    }
  });
  
  // Patient details update
  socket.on('patient-details-update', (data) => {
    try {
      const { 
        userId, 
        ambulanceId, 
        userName, 
        phone, 
        location, 
        patientCondition 
      } = data;
      
      console.log(`📋 Patient details update from user ${userId} for ambulance ${ambulanceId}`);
      
      // Store details
      activeConnections.patientDetails.set(userId, {
        userId,
        userName,
        phone,
        location,
        patientCondition,
        updatedAt: new Date()
      });
      
      // Update patient location entry
      const patientLocations = activeConnections.patientLocations.get(ambulanceId) || [];
      const patientIndex = patientLocations.findIndex(p => p.userId === userId);
      
      if (patientIndex >= 0) {
        patientLocations[patientIndex].patientInfo = {
          userName,
          phone,
          condition: patientCondition
        };
        patientLocations[patientIndex].hasDetails = true;
        activeConnections.patientLocations.set(ambulanceId, patientLocations);
        
        // Send to driver
        const driver = activeConnections.drivers.get(ambulanceId);
        if (driver) {
          io.to(driver.socketId).emit('patient-details-updated', {
            userId,
            userName,
            phone,
            location,
            patientCondition,
            timestamp: new Date().toISOString(),
            message: 'Patient details updated'
          });
        }
        
        // Send to hospital
        const hospitalPatientDetails = {
          userId,
          userName,
          phone,
          condition: patientCondition,
          ambulanceId,
          location,
          timestamp: new Date().toISOString(),
          type: 'Patient Details'
        };
        
        io.to('hospitals-room').emit('hospital-patient-details', hospitalPatientDetails);
      }
      
      // Save to MongoDB
      try {
        const emergency = new Emergency({
          patientName: userName,
          patientPhone: phone,
          emergencyType: 'Patient Information Shared',
          location: location,
          ambulanceId: ambulanceId,
          userId: userId,
          patientCondition: patientCondition,
          status: 'accepted'
        });
        
        emergency.save().catch(err => console.log('⚠️ MongoDB save failed:', err.message));
      } catch (dbError) {
        console.log('⚠️ MongoDB error:', dbError.message);
      }
      
    } catch (error) {
      console.error('Patient details update error:', error);
    }
  });
  
  // Emergency request from user
  socket.on('emergency-request', async (data) => {
    try {
      const { 
        userId, 
        userName, 
        phone, 
        location, 
        emergencyType, 
        patientCondition 
      } = data;
      
      console.log(`🚨 Emergency request from user ${userId}: ${emergencyType}`);
      
      const emergencyId = `EMG-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      const emergencyData = {
        emergencyId,
        userId,
        userName: userName || 'Unknown Patient',
        phone: phone || 'Not provided',
        location,
        emergencyType: emergencyType || 'Medical Emergency',
        patientCondition: patientCondition || 'Patient needs immediate assistance',
        status: 'pending',
        createdAt: new Date(),
        acceptedBy: null
      };
      
      activeConnections.pendingEmergencies.set(emergencyId, emergencyData);
      
      // Notify drivers
      io.to('drivers-room').emit('new-emergency', emergencyData);
      
      // Notify hospitals
      io.to('hospitals-room').emit('hospital-emergency-alert', {
        type: 'Emergency Request',
        patientName: emergencyData.userName,
        ambulanceId: null,
        location: emergencyData.location,
        timestamp: emergencyData.createdAt.toISOString(),
        condition: emergencyData.patientCondition,
        emergencyId
      });
      
      // Confirm to user
      const user = activeConnections.users.get(userId);
      if (user) {
        io.to(user.socketId).emit('emergency-request-confirmed', {
          emergencyId,
          message: 'Emergency request sent successfully.'
        });
      }
      
    } catch (error) {
      console.error('Emergency request error:', error);
    }
  });
  
  // Driver accepts emergency
  socket.on('accept-emergency', (data) => {
    try {
      const { emergencyId, ambulanceId, driverName, driverLocation } = data;
      
      console.log(`✅ Driver ${ambulanceId} accepting emergency ${emergencyId}`);
      
      const emergency = activeConnections.pendingEmergencies.get(emergencyId);
      if (emergency) {
        emergency.status = 'accepted';
        emergency.acceptedBy = ambulanceId;
        emergency.acceptedAt = new Date();
        
        activeConnections.pendingEmergencies.delete(emergencyId);
        activeConnections.trackingPairs.set(emergency.userId, ambulanceId);
        
        const driver = activeConnections.drivers.get(ambulanceId);
        const user = activeConnections.users.get(emergency.userId);
        
        if (driver && user) {
          const distance = calculateDistance(
            driverLocation.latitude || driver.location.latitude,
            driverLocation.longitude || driver.location.longitude,
            emergency.location.latitude,
            emergency.location.longitude
          );
          const eta = calculateETA(parseFloat(distance));
          
          // Notify user
          io.to(user.socketId).emit('emergency-accepted', {
            emergencyId,
            ambulanceId,
            driverName: driverName || driver.data.driverName,
            ambulancePhone: driver.data.phone,
            eta: eta,
            distance: distance,
            driverLocation: driverLocation || driver.location,
            message: 'Ambulance is on the way!'
          });
          
          // Notify driver
          io.to(driver.socketId).emit('emergency-accepted-driver', {
            emergencyId,
            userId: emergency.userId,
            userName: emergency.userName,
            userPhone: emergency.phone,
            userLocation: emergency.location,
            emergencyType: emergency.emergencyType,
            patientCondition: emergency.patientCondition,
            distance: distance,
            eta: eta
          });
          
          // Notify hospital
          const hospitalEmergencyAccept = {
            emergencyId,
            ambulanceId,
            driverName: driverName || driver.data.driverName,
            patientName: emergency.userName,
            condition: emergency.patientCondition,
            location: emergency.location,
            timestamp: new Date().toISOString(),
            status: 'accepted',
            distance,
            eta
          };
          
          io.to('hospitals-room').emit('hospital-emergency-accepted', hospitalEmergencyAccept);
        }
      }
    } catch (error) {
      console.error('Accept emergency error:', error);
    }
  });
  
  // User selects ambulance
  socket.on('user-select-ambulance', (data) => {
    try {
      const { userId, ambulanceId } = data;
      
      console.log(`🔗 User ${userId} selecting ambulance ${ambulanceId}`);
      
      const driver = activeConnections.drivers.get(ambulanceId);
      const user = activeConnections.users.get(userId);
      
      if (driver && user) {
        activeConnections.trackingPairs.set(userId, ambulanceId);
        
        socket.join(`tracking-${userId}-${ambulanceId}`);
        io.to(driver.socketId).join(`tracking-${userId}-${ambulanceId}`);
        
        io.to(user.socketId).emit('ambulance-selected', {
          ambulanceId,
          driverName: driver.data.driverName,
          phone: driver.data.phone,
          location: driver.location,
          vehicleType: driver.data.vehicleType || 'Basic Life Support'
        });
        
        io.to(driver.socketId).emit('user-selected-driver', {
          userId,
          userData: user.data,
          location: user.location
        });
        
        if (user.location) {
          setTimeout(() => {
            io.to(driver.socketId).emit('user-location', {
              userId,
              latitude: user.location.latitude,
              longitude: user.location.longitude,
              timestamp: user.lastUpdate.toISOString(),
              userName: user.data?.name || 'User'
            });
            
            if (driver.location) {
              const distance = calculateDistance(
                driver.location.latitude,
                driver.location.longitude,
                user.location.latitude,
                user.location.longitude
              );
              const eta = calculateETA(parseFloat(distance));
              
              io.to(driver.socketId).emit('distance-update-driver', {
                userId,
                distance,
                eta,
                userLocation: user.location
              });
              
              io.to(user.socketId).emit('distance-update', {
                ambulanceId,
                distance,
                eta
              });
            }
          }, 500);
        }
      }
    } catch (error) {
      console.error('User select ambulance error:', error);
    }
  });
  
  // Start tracking user
  socket.on('start-tracking-user', (data) => {
    try {
      const { ambulanceId, userId } = data;
      
      console.log(`📍 Driver ${ambulanceId} starting to track user ${userId}`);
      
      activeConnections.trackingPairs.set(userId, ambulanceId);
      
      const driver = activeConnections.drivers.get(ambulanceId);
      const user = activeConnections.users.get(userId);
      
      if (driver && user && user.location) {
        io.to(driver.socketId).emit('user-location', {
          userId,
          latitude: user.location.latitude,
          longitude: user.location.longitude,
          timestamp: user.lastUpdate.toISOString(),
          userName: user.data?.name || 'User'
        });
        
        if (driver.location) {
          const distance = calculateDistance(
            driver.location.latitude,
            driver.location.longitude,
            user.location.latitude,
            user.location.longitude
          );
          const eta = calculateETA(parseFloat(distance));
          
          io.to(driver.socketId).emit('distance-update-driver', {
            userId,
            distance,
            eta,
            userLocation: user.location
          });
        }
      }
    } catch (error) {
      console.error('Start tracking error:', error);
    }
  });
  
  // Driver requests patient details
  socket.on('driver-request-patient-details', (data) => {
    try {
      const { ambulanceId, userId } = data;
      
      console.log(`📋 Driver ${ambulanceId} requesting details for user ${userId}`);
      
      const patientDetails = activeConnections.patientDetails.get(userId);
      const user = activeConnections.users.get(userId);
      
      if (patientDetails && user) {
        const driver = activeConnections.drivers.get(ambulanceId);
        if (driver) {
          io.to(driver.socketId).emit('patient-details-response', {
            userId,
            userName: patientDetails.userName,
            phone: patientDetails.phone,
            location: patientDetails.location,
            patientCondition: patientDetails.patientCondition,
            updatedAt: patientDetails.updatedAt
          });
        }
      } else {
        const driver = activeConnections.drivers.get(ambulanceId);
        if (driver) {
          io.to(driver.socketId).emit('patient-details-response', {
            userId,
            message: 'Patient details not available yet'
          });
        }
      }
    } catch (error) {
      console.error('Driver request patient details error:', error);
    }
  });
  
  // Hospital requests ambulances - NEW
  socket.on('hospital-request-ambulances', (data) => {
    try {
      const { hospitalId } = data;
      
      const hospital = activeConnections.hospitals.get(hospitalId);
      if (hospital) {
        const onlineAmbulances = Array.from(activeConnections.drivers.values())
          .filter(d => d.data && d.location)
          .map(d => ({
            ambulanceId: d.data.ambulanceId,
            driverName: d.data.driverName,
            phone: d.data.phone,
            vehicleType: d.data.vehicleType || 'Basic Life Support',
            location: d.location,
            status: 'active',
            lastUpdate: d.lastUpdate,
            currentPatient: null
          }));
        
        io.to(hospital.socketId).emit('hospital-ambulances-update', onlineAmbulances);
      }
    } catch (error) {
      console.error('Hospital ambulances request error:', error);
    }
  });
  
  // Hospital dispatches ambulance - NEW
  socket.on('hospital-dispatch-ambulance', (data) => {
    try {
      const { hospitalId, ambulanceId, destination, patientInfo } = data;
      
      console.log(`🏥 Hospital ${hospitalId} dispatching ambulance ${ambulanceId}`);
      
      const driver = activeConnections.drivers.get(ambulanceId);
      const hospital = activeConnections.hospitals.get(hospitalId);
      
      if (driver && hospital) {
        // Notify driver
        io.to(driver.socketId).emit('hospital-dispatch-request', {
          hospitalId,
          hospitalName: hospital.data.hospitalName,
          destination,
          patientInfo,
          timestamp: new Date().toISOString()
        });
        
        // Add to hospital assignments
        const assignments = activeConnections.hospitalAssignments.get(hospitalId) || [];
        if (!assignments.includes(ambulanceId)) {
          assignments.push(ambulanceId);
          activeConnections.hospitalAssignments.set(hospitalId, assignments);
        }
        
        // Confirm to hospital
        io.to(hospital.socketId).emit('dispatch-confirmed', {
          ambulanceId,
          driverName: driver.data.driverName,
          status: 'dispatched',
          timestamp: new Date().toISOString()
        });
        
        console.log(`✅ Ambulance ${ambulanceId} dispatched by hospital ${hospitalId}`);
      }
    } catch (error) {
      console.error('Hospital dispatch error:', error);
    }
  });
  
  // Disconnect handler
  socket.on('disconnect', (reason) => {
    console.log(`🔌 Disconnected: ${socket.id} - Reason: ${reason}`);
    
    // Remove driver
    for (const [ambulanceId, driver] of activeConnections.drivers.entries()) {
      if (driver.socketId === socket.id) {
        activeConnections.drivers.delete(ambulanceId);
        activeConnections.patientLocations.delete(ambulanceId);
        
        console.log(`🚑 Driver ${ambulanceId} disconnected`);
        
        io.emit('driver-disconnected', { ambulanceId });
        
        for (const [userId, trackedAmbulanceId] of activeConnections.trackingPairs.entries()) {
          if (trackedAmbulanceId === ambulanceId) {
            activeConnections.trackingPairs.delete(userId);
          }
        }
        
        const onlineAmbulances = Array.from(activeConnections.drivers.values())
          .filter(d => d.data && d.location)
          .map(d => ({
            ambulanceId: d.data.ambulanceId,
            driverName: d.data.driverName,
            phone: d.data.phone,
            vehicleType: d.data.vehicleType || 'Basic Life Support',
            location: d.location,
            lastUpdate: d.lastUpdate
          }));
        
        io.emit('online-ambulances-update', onlineAmbulances);
        
        // Notify hospitals
        io.to('hospitals-room').emit('hospital-ambulance-disconnected', { ambulanceId });
        
        break;
      }
    }
    
    // Remove user
    for (const [userId, user] of activeConnections.users.entries()) {
      if (user.socketId === socket.id) {
        activeConnections.users.delete(userId);
        activeConnections.trackingPairs.delete(userId);
        activeConnections.patientDetails.delete(userId);
        
        for (const [ambulanceId, patientLocations] of activeConnections.patientLocations.entries()) {
          const filtered = patientLocations.filter(p => p.userId !== userId);
          activeConnections.patientLocations.set(ambulanceId, filtered);
        }
        
        console.log(`👤 User ${userId} disconnected`);
        break;
      }
    }
    
    // Remove hospital - NEW
    for (const [hospitalId, hospital] of activeConnections.hospitals.entries()) {
      if (hospital.socketId === socket.id) {
        activeConnections.hospitals.delete(hospitalId);
        activeConnections.hospitalAssignments.delete(hospitalId);
        
        console.log(`🏥 Hospital ${hospitalId} disconnected`);
        break;
      }
    }
  });
  
  // Error handler
  socket.on('error', (error) => {
    console.error('Socket error:', error);
  });
});

// Start server
const PORT = process.env.PORT || 5000;
const HOST = '0.0.0.0';

server.listen(PORT, HOST, () => {
  console.log(`🚀 Server running at http://${HOST}:${PORT}`);
  console.log(`📡 WebSocket server ready for connections`);
  console.log(`📊 Status: http://${HOST}:${PORT}/`);
  console.log(`🔗 Socket.IO URL: http://${HOST}:${PORT}`);
});
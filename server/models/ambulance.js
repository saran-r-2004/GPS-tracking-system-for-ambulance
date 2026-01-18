const mongoose = require('mongoose');

const ambulanceSchema = new mongoose.Schema({
  ambulanceId: { 
    type: String, 
    required: true, 
    unique: true,
    index: true
  },
  driverName: { 
    type: String, 
    required: true 
  },
  phone: { 
    type: String, 
    required: true,
    unique: true,
    index: true
  },
  vehicleType: { 
    type: String, 
    default: 'Basic Life Support' 
  },
  status: { 
    type: String, 
    enum: ['available', 'on-duty', 'busy', 'offline'],
    default: 'offline',
    index: true
  },
  location: {
    latitude: { type: Number, default: 0 },
    longitude: { type: Number, default: 0 },
    lastUpdated: { type: Date, default: Date.now }
  },
  isActive: { 
    type: Boolean, 
    default: true 
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  updatedAt: { 
    type: Date, 
    default: Date.now 
  }
});

// Update the updatedAt field on save
ambulanceSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Ambulance', ambulanceSchema);
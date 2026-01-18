const mongoose = require('mongoose');

const emergencySchema = new mongoose.Schema({
  patientName: { 
    type: String, 
    required: true 
  },
  patientPhone: { 
    type: String, 
    required: true,
    index: true
  },
  emergencyType: { 
    type: String, 
    required: true 
  },
  location: {
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true }
  },
  ambulanceId: { 
    type: String, 
    index: true 
  },
  status: { 
    type: String, 
    enum: ['pending', 'accepted', 'enroute', 'arrived', 'completed', 'cancelled'],
    default: 'pending',
    index: true
  },
  acceptedAt: Date,
  arrivedAt: Date,
  completedAt: Date,
  createdAt: { 
    type: Date, 
    default: Date.now,
    index: true 
  },
  updatedAt: { 
    type: Date, 
    default: Date.now 
  }
});

// Update the updatedAt field on save
emergencySchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Emergency', emergencySchema);
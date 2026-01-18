// server/models/hospital.js
const mongoose = require('mongoose');

const hospitalSchema = new mongoose.Schema({
  hospitalId: {
    type: String,
    unique: true,
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    unique: true,
    required: true,
    index: true
  },
  password: {
    type: String,
    required: true
  },
  phone: String,
  address: String,
  city: String,
  state: String,
  pincode: String,
  location: {
    latitude: Number,
    longitude: Number
  },
  departments: [String],
  ambulanceIds: [String], // Array of ambulance IDs assigned to this hospital
  totalBeds: Number,
  icuBeds: Number,
  emergencyContacts: [String],
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
hospitalSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Hospital', hospitalSchema);
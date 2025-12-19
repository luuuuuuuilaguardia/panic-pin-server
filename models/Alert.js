const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema({
    user_id: {
        type: String,
        required: true
    },
    lat: {
        type: Number,
        required: true
    },
    lon: {
        type: Number,
        required: true
    },
    location: {
        type: String,
        default: 'Unknown Location'
    },
    distance: {
        type: Number,
        default: 0
    },
    timestamp: {
        type: Date,
        default: Date.now
    },
    status: {
        type: String,
        enum: ['pending', 'ongoing', 'resolved'],
        default: 'pending'
    },
    isFalseAlert: {
        type: Boolean,
        default: false
    },
    responseTime: {
        type: Number,
        default: null
    },
    resolvedAt: {
        type: Date,
        default: null
    }
});

module.exports = mongoose.model('Alert', alertSchema);

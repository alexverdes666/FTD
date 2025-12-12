const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
router.get('/', async (req, res) => {
    try {
        const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
        const health = {
            status: 'ok',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            database: {
                status: dbStatus
            },
            memory: {
                usage: process.memoryUsage()
            }
        };
        res.json(health);
    } catch (error) {
        res.status(503).json({
            status: 'error',
            message: 'Health check failed',
            error: error.message
        });
    }
});
module.exports = router;
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const dotenv = require('dotenv');
const AppError = require('./utils/appError');

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
}

const studentRoutes = require('./routes/studentRoutes');
const aiRoutes = require('./routes/aiRoutes');
const demoRoutes = require('./routes/demoRoutes');

app.use('/api/student', studentRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/demo', demoRoutes);

// Test Endpoint
app.get('/', (req, res) => {
    res.status(200).json({ status: 'success', message: 'GenEduPlanner Backend API is running' });
});

// 404 Handler
// 404 Handler
app.use((req, res, next) => {
    next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

// Global Error Handler
app.use((err, req, res, next) => {
    err.statusCode = err.statusCode || 500;
    err.status = err.status || 'error';

    res.status(err.statusCode).json({
        status: err.status,
        message: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
});

const PORT = process.env.PORT || 5000;

// Only run listen if not imported (Vercel imports it)
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}

module.exports = app;

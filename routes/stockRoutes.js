const express = require('express');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const Stock = require('../models/stock');
const router = express.Router();

// Multer Setup for file uploads
const upload = multer({ dest: 'uploads/' });

// CSV Upload and Validation Endpoint
router.post('/upload', upload.single('file'), (req, res) => {
    if (!req.file || req.file.mimetype !== 'text/csv') {
        return res.status(400).json({ message: 'Please upload a CSV file' });
    }

    const results = [];
    const failedRecords = [];
    let successCount = 0;
    let failureCount = 0;

    fs.createReadStream(req.file.path)
        .pipe(csv())
        .on('data', (row) => {
            const {
                Date: csvDate, // Rename Date to csvDate to avoid conflict with global Date constructor
                Symbol, Series, PrevClose, Open, High, Low, Last, Close, VWAP,
                Volume, Turnover, Trades, Deliverable, '%Deliverable': percent_deliverable
            } = row;
            
            // Basic Validation
            if (csvDate && !isNaN(new Date(csvDate)) && !isNaN(PrevClose) && !isNaN(Open) &&
                !isNaN(High) && !isNaN(Low) && !isNaN(Last) && !isNaN(Close) && !isNaN(VWAP) &&
                !isNaN(Volume) && !isNaN(Turnover) && !isNaN(Trades) && !isNaN(Deliverable) &&
                !isNaN(percent_deliverable)) {
                
                // Push to results if valid
                results.push({
                    date: new Date(csvDate), // Use the renamed variable csvDate here
                    symbol: Symbol,
                    series: Series,
                    prev_close: parseFloat(PrevClose),
                    open: parseFloat(Open),
                    high: parseFloat(High),
                    low: parseFloat(Low),
                    last: parseFloat(Last),
                    close: parseFloat(Close),
                    vwap: parseFloat(VWAP),
                    volume: parseInt(Volume),
                    turnover: parseFloat(Turnover),
                    trades: parseInt(Trades),
                    deliverable: parseInt(Deliverable),
                    percent_deliverable: parseFloat(percent_deliverable)
                });
                successCount++;
            } else {
                failedRecords.push(row);
                failureCount++;
            }
        })        
        
        .on('end', async () => {
            try {
                // Insert valid records into MongoDB
                await Stock.insertMany(results);
                res.json({
                    totalRecords: successCount + failureCount,
                    successfulRecords: successCount,
                    failedRecords: failureCount,
                    failedDetails: failedRecords
                });
            } catch (err) {
                res.status(500).json({ message: 'Error saving data to database' });
            }
            fs.unlinkSync(req.file.path);  // Remove uploaded file
        });
});

// API to get record with the highest volume
router.get('/highest_volume', async (req, res) => {
    const { start_date, end_date, symbol } = req.query;
    
    // Build the query object
    const query = {
        date: { $gte: new Date(start_date), $lte: new Date(end_date) }
    };
    if (symbol) query.symbol = symbol;

    try {
        const stock = await Stock.find(query).sort({ volume: -1 }).limit(1);
        res.json(stock);
    } catch (err) {
        res.status(500).json({ message: 'Error retrieving data' });
    }
});

// API to calculate average close price for a symbol
router.get('/average_close', async (req, res) => {
    const { start_date, end_date, symbol } = req.query;
    
    const query = {
        date: { $gte: new Date(start_date), $lte: new Date(end_date) },
        symbol
    };

    try {
        const stock = await Stock.aggregate([
            { $match: query },
            { $group: { _id: null, average_close: { $avg: "$close" } } }
        ]);
        res.json({ average_close: stock[0]?.average_close || 0 });
    } catch (err) {
        res.status(500).json({ message: 'Error calculating average close' });
    }
});

// API to calculate average VWAP for a symbol or date range
router.get('/average_vwap', async (req, res) => {
    const { start_date, end_date, symbol } = req.query;
    
    const query = {
        date: { $gte: new Date(start_date), $lte: new Date(end_date) }
    };
    if (symbol) query.symbol = symbol;

    try {
        const stock = await Stock.aggregate([
            { $match: query },
            { $group: { _id: null, average_vwap: { $avg: "$vwap" } } }
        ]);
        res.json({ average_vwap: stock[0]?.average_vwap || 0 });
    } catch (err) {
        res.status(500).json({ message: 'Error calculating average VWAP' });
    }
});

module.exports = router;

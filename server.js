const express = require('express');
const mongoose = require('mongoose');
const stockRoutes = require('./routes/stockRoutes');
const app = express();

// MongoDB Connection
mongoose.connect('mongodb://localhost:27017/stockdb', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
}).then(() => console.log('MongoDB connected'))
.catch((err) => console.log(err));

app.use(express.json());

// Use Routes
app.use('/api', stockRoutes);

// Server Listening
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

const express = require('express');
const cors = require('cors');
const usersRoutes = require('./src/users/routes');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/users', usersRoutes);
app.use('/api/orders', require('./src/orders/routes'));
app.use('/api/restaurants', require('./src/restaurants/routes'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

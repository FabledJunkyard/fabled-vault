const express = require('express');
app = express();
app.use(express.static('public'));
app.listen(3101, () => console.log('Vault UI:3101'));

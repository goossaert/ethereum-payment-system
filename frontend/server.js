const express = require('express');

const app = express();
const port = process.env.PORT || 8080;

app.use(express.static('./dist/frontend'));

app.get('/*', (req, res) =>
    res.sendFile('index.html', {root: './dist/frontend/'}),
);

app.listen(port, () => console.log(`App running on: http://localhost:${port}`));

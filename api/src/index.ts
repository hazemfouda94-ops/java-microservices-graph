import express from 'express';
import { setRoutes } from './routes/analysis';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
setRoutes(app);

app.listen(PORT, () => {
    console.log(`API server is running on http://localhost:${PORT}`);
});
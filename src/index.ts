// src/index.ts
import express, { Request, Response } from 'express';

const app = express();
const port = process.env.PORT || 5000;

app.get('/', (req: Request, res: Response) => {
    res.send('Backend Express (TypeScript) Berhasil Berjalan!');
});

app.listen(port, () => {
    console.log(`Server Express berjalan di http://localhost:${port}`);
});
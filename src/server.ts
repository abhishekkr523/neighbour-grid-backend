import express, { Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Frontend (Angular Host 4200) को एक्सेस दें
app.use(cors({ origin: "http://localhost:4200", credentials: true }));
app.use(express.json());

// टेस्ट रूट
app.get("", (req: Request, res: Response) => {
  res.json({
    status: "UP",
    message: "NeighborGrid Backend is running successfully!",
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

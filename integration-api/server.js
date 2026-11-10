import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import morgan from "morgan";
import analyzeRoute from "./routes/analyzeRoute.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(morgan('dev'));

// Log all requests
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Routes
app.use('/integrate', analyzeRoute);

// Root endpoint
app.get("/", (req, res) => {
  res.json({ 
    message: "🔗 Integration API running successfully",
    version: "1.0.0",
    endpoints: {
      analyze: "POST /integrate/analyze",
      health: "GET /integrate/health",
      queueStatus: "GET /integrate/queue-status"
    }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: "Endpoint not found",
    path: req.url,
    method: req.method
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    error: "Internal server error",
    message: err.message
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`\n Integration API running on port ${PORT}`);
  console.log(` Concurrency limit: ${process.env.MAX_CONCURRENT_ANALYSES || 3}; queue capacity: ${process.env.MAX_QUEUE_SIZE || 10}`);
  console.log(` Ready to orchestrate statistical analyses!\n`);
});

export default app;
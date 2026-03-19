import { connectDB } from "./config/db";
import {env} from "./config/env";
import app from "./app";
import logger from "./utils/logger";

const start = async () => {
  try {
    await connectDB();
    app.listen(env.PORT, () => {
      logger.info(`Server is running on port ${env.PORT} ✓`);
    });
  } catch (error) {
    console.error("Failed to start the server:", error);
    process.exit(1);
  }
};

start();
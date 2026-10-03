import { env } from "./config/env.js";
import { createApp } from "./app.js";

const port = env.PORT ? parseInt(env.PORT, 10) : 3000;
const app = createApp();

app.listen(port, () => {
  console.log(`DFQLABS OS 2.0 Server listening on port ${port}`);
});

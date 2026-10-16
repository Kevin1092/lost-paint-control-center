import { app } from './app';

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`[Lost Paint Studios] Server running on http://localhost:${PORT}`);
  console.log(`[Lost Paint Studios] Health check available at http://localhost:${PORT}/api/health`);
});

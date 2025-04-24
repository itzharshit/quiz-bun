// Simple Bun server for Vercel
export default {
  port: process.env.PORT || 3000,
  fetch(req: Request) {
    return new Response("Hello from Bun on Vercel!");
  },
};

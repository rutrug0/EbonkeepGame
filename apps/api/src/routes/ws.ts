import type { FastifyPluginAsync } from "fastify";

export const websocketRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    "/ws",
    { websocket: true },
    (socket) => {
      const tick = setInterval(() => {
        if (socket.readyState === socket.OPEN) {
          socket.send(
            JSON.stringify({
              type: "ServerTimeSync",
              serverTime: new Date().toISOString()
            })
          );
        }
      }, 5000);

      socket.on("message", (message: unknown) => {
        const text =
          typeof message === "string"
            ? message
            : Buffer.isBuffer(message)
              ? message.toString("utf8")
              : String(message);
        if (socket.readyState === socket.OPEN) {
          socket.send(
            JSON.stringify({
              type: "SystemStatusChanged",
              status: "ok",
              echo: text
            })
          );
        }
      });

      socket.on("close", () => {
        clearInterval(tick);
      });
    }
  );
};

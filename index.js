import pkg from "whatsapp-web.js";
const { Client, LocalAuth } = pkg;
import qrcode from "qrcode-terminal";
import { runModel } from "./chat_with_assistant.js";
import express from "express"; // Use Express for HTTP server

// Initialize WhatsApp client
const client = new Client({
  puppeteer: {
    headless: true,
    args: ["--no-sandbox"],
  },
  authStrategy: new LocalAuth(),
  webVersionCache: {
    type: "remote",
    remotePath:
      "https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2411.2.html",
  },
  authTimeoutMs: 60000, // Optional: timeout for authentication in milliseconds
  qrTimeout: 30000, // Optional: timeout for QR code generation
});

// Event listener for QR code generation
client.on("qr", (qr) => {
  qrcode.generate(qr, { small: true });
  console.log("QR code generated. Scan it with your WhatsApp app.");
});

// Event listener for when the client is ready
client.on("ready", () => {
  console.log("Client is ready!");
});

// Event listener for successful authentication
client.on("authenticated", () => {
  console.log("Client is authenticated!");
});

// Event listener for authentication failure
client.on("auth_failure", (msg) => {
  console.error("Authentication failure:", msg);
});

// Event listener for incoming messages
client.on("message", async (msg) => {
  console.log("MESSAGE RECEIVED", msg);

  try {
    // Mark the message as seen and indicate availability
    await client.sendSeen(msg.from);
    await client.sendPresenceAvailable();

    // Generate a response using the AI model
    const response = await runModel(msg.body);
    console.log("RESPONSE", response);

    // Send the response back to the user
    await client.sendMessage(msg.from, response);
  } catch (error) {
    console.error("Error in processing message:", error);
    await client.sendMessage(
      msg.from,
      "There was an error processing your request. Please try again later."
    );
  }
});

// Initialize the WhatsApp client
client
  .initialize()
  .then(() => {
    console.log("Client initialized successfully");
  })
  .catch((err) => {
    console.error("Error initializing client:", err);
  });

// Create an Express server for Render's port binding requirement
const app = express();
const PORT = process.env.PORT || 3000;

// Define a simple route for monitoring or debugging
app.get("/", (req, res) => {
  res.send(`
    <h1>WhatsApp Bot is Running</h1>
    <p>The bot is active and ready to receive messages.</p>
    <p>Check logs for QR code or incoming messages.</p>
  `);
});

// Start listening on the specified port and host
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server is running on http://0.0.0.0:${PORT}`);
});

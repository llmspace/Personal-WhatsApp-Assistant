import pkg from "whatsapp-web.js";
const { Client, LocalAuth } = pkg;
import qrcode from "qrcode-terminal";
import { runModel } from "./chat_with_assistant.js";
import http from "http"; // Import HTTP module for Render port binding

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
  console.error("Authentication failure", msg);
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
    console.error("Error in generating assessment", error);
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
    console.error("Error initializing client", err);
  });

// Add an HTTP server for Render port binding
const PORT = process.env.PORT || 3000; // Use PORT environment variable or default to 3000
const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("WhatsApp bot is running!\n");
});

// Start listening on the specified port
server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server is running on http://0.0.0.0:${PORT}`);
});


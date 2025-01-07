import pkg from "whatsapp-web.js";
const { Client, LocalAuth } = pkg;
import qrcode from "qrcode";
import express from "express"; // Use Express for HTTP server
import fs from "fs";
import path from "path";
import { runModel } from "./chat_with_assistant.js";

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Initialize WhatsApp client
const client = new Client({
  puppeteer: {
    headless: true,
    args: ["--no-sandbox"],
  },
  authStrategy: new LocalAuth(),
});

// Serve a simple UI with the QR code
app.get("/", (req, res) => {
  const qrPath = path.join(__dirname, "qr.png");
  if (fs.existsSync(qrPath)) {
    res.send(`
      <h1>WhatsApp Bot is Running</h1>
      <p>Scan the QR code below to authenticate:</p>
      <img src="/qr" alt="QR Code" />
    `);
  } else {
    res.send(`
      <h1>WhatsApp Bot is Running</h1>
      <p>Waiting for QR code to be generated. Please check back shortly.</p>
    `);
  }
});

// Serve the QR code image
app.get("/qr", (req, res) => {
  const qrPath = path.join(__dirname, "qr.png");
  if (fs.existsSync(qrPath)) {
    res.sendFile(qrPath);
  } else {
    res.status(404).send("QR code not generated yet.");
  }
});

// Event listener for QR code generation
client.on("qr", async (qr) => {
  console.log("QR Code received. Generating image...");
  try {
    await qrcode.toFile("./qr.png", qr); // Save QR code as an image
    console.log("QR Code saved as qr.png");
  } catch (err) {
    console.error("Error generating QR Code:", err);
  }
});

// Event listener for when the client is ready
client.on("ready", () => {
  console.log("Client is ready!");
});

// Event listener for successful authentication
client.on("authenticated", () => {
  console.log("Client authenticated!");
});

// Event listener for authentication failure
client.on("auth_failure", (msg) => {
  console.error("Authentication failure:", msg);
});

// Event listener for incoming messages
client.on("message", async (msg) => {
  console.log("MESSAGE RECEIVED:", msg);

  try {
    const response = await runModel(msg.body);
    await client.sendMessage(msg.from, response);
    console.log("RESPONSE SENT:", response);
  } catch (error) {
    console.error("Error processing message:", error);
    await client.sendMessage(
      msg.from,
      "There was an error processing your request. Please try again later."
    );
  }
});

// Start WhatsApp client
client.initialize();

// Start Express server
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server is running at http://0.0.0.0:${PORT}`);
});

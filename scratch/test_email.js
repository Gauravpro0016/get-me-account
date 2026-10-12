const nodemailer = require("nodemailer");
const fs = require("fs");
const path = require("path");

// Read .env.local manually
const envPath = path.join(process.cwd(), ".env.local");
const envContent = fs.readFileSync(envPath, "utf-8");
const env = {};
envContent.split("\n").forEach((line) => {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith("#")) {
    const idx = trimmed.indexOf("=");
    if (idx !== -1) {
      const k = trimmed.substring(0, idx).trim();
      const v = trimmed.substring(idx + 1).trim().replace(/^["']|["']$/g, "");
      env[k] = v;
    }
  }
});

const user = (env.GMAIL_USER || "").trim();
const pass = (env.GMAIL_APP_PASSWORD || "").replace(/\s+/g, "");

console.log("Testing Gmail SMTP with user:", user);
console.log("App password length:", pass.length);

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: { user, pass },
  connectionTimeout: 10000,
});

transporter.verify((error, success) => {
  if (error) {
    console.error("Nodemailer verify FAILED:", error);
  } else {
    console.log("Nodemailer verify SUCCESS: Server is ready to take our messages");
  }
});

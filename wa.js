/*
Wak-Waw.  
Whatsapp Bot yang Baik nan Bersahaja.

Author  : gibrain.wordpress.com
Lisensi : Minta doanya aja yg baek-baek.
*/

// Persyaratan
const QRCode = require("qrcode");
const { Client, LocalAuth, MessageMedia } = require("whatsapp-web.js");
const express = require("express");
const { body, validationResult } = require("express-validator");
const http = require("http");
const fs = require("fs");
const sqlite3 = require("sqlite3").verbose();
const port = process.env.PORT || 8000;
const DB_PATH = "./antrian.db";
const app = express();
const server = http.createServer(app);

// init db
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error("Database connection error:", err.message);
  } else {
    console.log("Connected to the SQLite database");
    db.run("PRAGMA journal_mode = WAL;");
  }
});

// init client browser. chromium.
const client = new Client({
  restartOnAuthFail: true,
  puppeteer: {
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--no-first-run",
      "--no-zygote",
      "--single-process",
      "--disable-gpu",
    ],
  },
  // AuthCache 
  // * agar tidak perlu scan ulang qr tiap ada perubahan kode
  // * w/a biasanya keep sesi selama 1 bulan 
  authStrategy: new LocalAuth({ clientId: "wamil" }),
});

// Genesis.
// Phil Collins asik juga.
// Another day in paradise.
client.initialize();
console.log("starting..., tunggu kemunculan qr.");

client.on("ready", async () => {
  console.log(new Date().toISOString() + ": WAK.WAW !. Bot siap terima perintah.");
  startQueueProcessor();
});

// qrcode area
let qrBase64 = null;

client.on("qr", async (qr) => {
  console.log("QR diterima, membuat base64 image.");
  QRCode.toDataURL(qr, (err, base64Image) => {
    if (err) {
      console.error("Error generating QR code:", err);
      return;
    }
    qrBase64 = base64Image;
    console.log("QrGenerated");
    console.log("1. Hit /qr atau buka qr.html");
    console.log("2. Pair perangkat");
    console.log("3. Tunggu hingga wak.waw muncul");
  });
});

function queueMessage(number, message, pdfPath = null) {
  return new Promise((resolve, reject) => {
    const now = new Date().toISOString();
    const formattedNumber = number + "@c.us";

    db.run(
      `INSERT INTO antrian (tgl, nomor, pesan, berkas, status) VALUES (?, ?, ?, ?, ?)`,
      [now, formattedNumber, message, pdfPath, 0],
      function (err) {
        if (err) {
          console.error("Error queueing message:", err);
          reject(err);
        } else {
          console.log(`Message queued with ID: ${this.lastID}`);
          resolve(this.lastID);
        }
      }
    );
  });
}

function randomDelay(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function startQueueProcessor() {
  const scheduleNext = () => {
    // delay aman: 15 s.d 20 menit
    const delay = randomDelay(900000, 1200000);
    setTimeout(async () => {
      await processMessageQueue();
      scheduleNext();
    }, delay);
  };
  scheduleNext();
}

let isProcessingQueue = false;

async function processMessageQueue() {
  if (isProcessingQueue) return;
  isProcessingQueue = true;

  db.serialize(() => {
    db.run("BEGIN", (beginErr) => {
      if (beginErr) {
        console.error("Failed to start transaction:", beginErr);
        isProcessingQueue = false;
        return;
      }

      db.get(
        `SELECT * FROM antrian WHERE status = 0 ORDER BY tgl ASC LIMIT 1`,
        (err, row) => {
          if (err) {
            console.error("Error fetching queue:", err);
            db.run("ROLLBACK", () => {
              isProcessingQueue = false;
            });
            return;
          }

          if (!row) {
            db.run("ROLLBACK", () => {
              isProcessingQueue = false;
            });
            return;
          }

          db.run(
            `UPDATE antrian SET status = 3 WHERE id=?`,
            [row.id],
            (uErr) => {
              if (uErr) {
                console.error("Error updating status to processing:", uErr);
                db.run("ROLLBACK", () => {
                  isProcessingQueue = false;
                });
                return;
              }

              db.run("COMMIT", async (commitErr) => {
                isProcessingQueue = false;

                if (commitErr) {
                  console.error("Commit error:", commitErr);
                  return;
                }

                try {
                  const checkNumber = row.nomor.replace("@c.us", "");
                  db.get(
                    `SELECT 1 FROM kontak WHERE nomor=?`,
                    [checkNumber],
                    async (e2, exist) => {
                      if (!exist) {
                        const nameMatch = (row.pesan.match(
                          /Yth\.\s*(.*?)\./i
                        ) || [, ""])[1].trim();
                        db.run(
                          `INSERT OR IGNORE INTO kontak (nomor,name,status) VALUES (?,?,0)`,
                          [row.nomor, nameMatch]
                        );
                        await updateMessageStatus(
                          row.id,
                          2,
                          "contact not found"
                        );
                        return;
                      }

                      try {
                        if (row.berkas) await sendMessageWithAttachment(row);
                        else await sendTextMessage(row);

                        await updateMessageStatus(row.id, 1);
                      } catch (sendErr) {
                        await updateMessageStatus(
                          row.id,
                          2,
                          sendErr.message.split("\n")[0]
                        );
                      }
                    }
                  );
                } catch (error) {
                  await updateMessageStatus(
                    row.id,
                    2,
                    error.message.split("\n")[0]
                  );
                }
              });
            }
          );
        }
      );
    });
  });
}

async function syncContacts() {
  try {
    const contacts = await client.getContacts();

    db.serialize(() => {
      const stmt = db.prepare(
        `INSERT OR IGNORE INTO kontak (nomor,name,status) VALUES (?,?,?)`
      );

      contacts.forEach((c) => {
        if (!c.number) return;

        // Filter Logic: Only allow numbers starting with specific prefixes
        // We check for both '+62' and '62' because the library often strips the '+'
        if (
          c.number.startsWith("08") ||
          c.number.startsWith("+62") ||
          c.number.startsWith("62") ||
          c.number.startsWith("+67") ||
          c.number.startsWith("67")
        ) {
          stmt.run(c.number, c.name || "", 1);
        }
      });

      stmt.finalize((err) => {
        if (err) console.error("Finalize error:", err);
      });
    });

    return { synced: contacts.length };
  } catch (err) {
    console.error("syncContacts error:", err);
    throw err;
  }
}

async function simulateTyping(chatId, message) {
  const typingDuration = randomDelay(1000, 3000);
  const pauseBefore = randomDelay(1000, 2000);

  await new Promise((resolve) => setTimeout(resolve, pauseBefore));

  const chat = await client.getChatById(chatId);
  await chat.sendStateTyping();

  await new Promise((resolve) => setTimeout(resolve, typingDuration));
}

async function sendTextMessage(messageData) {
  try {
    // Try typing simulation, but continue if it fails
    try {
      await simulateTyping(messageData.nomor, messageData.pesan);
    } catch (typingError) {
      console.log("Typing skipped, proceeding with send");
      await new Promise((resolve) =>
        setTimeout(resolve, randomDelay(2000, 4000))
      );
    }

    await client.sendMessage(messageData.nomor, messageData.pesan);
    console.log(messageData.id + " : 1");
  } catch (error) {
    console.error("Error sending text message:", error);
    throw error;
  }
}

async function sendMessageWithAttachment(messageData) {
  try {
    const pdfPath = messageData.berkas;
    if (!fs.existsSync(pdfPath))
      throw new Error("PDF file not found: " + pdfPath);

    await simulateTyping(messageData.nomor, messageData.pesan);

    const media = MessageMedia.fromFilePath(pdfPath);
    await client.sendMessage(messageData.nomor, media, {
      caption: messageData.pesan,
    });
  } catch (error) {
    console.error("Error sending message with attachment:", error);
    throw error;
  }
}

function updateMessageStatus(id, status, error_message = "") {
  return new Promise((resolve, reject) => {
    const now = new Date().toISOString();
    db.run(
      `UPDATE antrian SET status = ?, tgl_kirim = ? , error = ? WHERE id = ?`,
      [status, now, error_message, id],
      function (err) {
        if (err) {
          console.error("Error updating message status:", err);
          reject(err);
        } else {
          resolve();
        }
      }
    );
  });
}

// Peladen API
// Jiah peladen. pak raden kali.
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Dukungan issue cors.
// * Pastikan endpoint hanya bisa diakses dari IP yg diizinken
// * expose wak-waw via nginx / apache proxy vhost
// * Restrict Allow ip dari config proxy tsb
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  next();
});

// -- END POINT AREA --

// get qr code
app.get("/qr", (req, res) => {
  if (!qrBase64) {
    return res.status(404).json({ error: "QR code not yet generated." });
  }
  res.json({ qr: qrBase64 });
});

// sync kontak
app.get("/sync", async (req, res) => {
  try {
    const result = await syncContacts();
    res.json({ status: true, result });
  } catch (e) {
    res.status(500).json({ status: false, error: e.message });
  }
});

// kirim pesen
app.post(
  "/send",
  [body("number").notEmpty(), body("message").notEmpty()],
  async (req, res) => {
    const errors = validationResult(req).formatWith(({ msg }) => msg);
    if (!errors.isEmpty())
      return res.status(422).json({ status: false, message: errors.mapped() });

    try {
      const queueId = await queueMessage(req.body.number, req.body.message);
      res
        .status(200)
        .json({
          status: true,
          message: "Message queued successfully",
          queueId: queueId,
        });
    } catch (err) {
      res
        .status(500)
        .json({
          status: false,
          message: "Failed to queue message",
          error: err.message,
        });
    }
  }
);

// cek status antrian
app.get("/status", (req, res) => {
  db.all(
    `SELECT status, COUNT(*) as count FROM antrian GROUP BY status`,
    (err, rows) => {
      if (err)
        return res.status(500).json({ status: false, error: err.message });

      const status = { queued: 0, sent: 0, failed: 0 };
      rows.forEach((row) => {
        if (row.status === 0) status.queued = row.count;
        if (row.status === 1) status.sent = row.count;
        if (row.status === 2) status.failed = row.count;
      });
      res.status(200).json({ status: true, queue: status });
    }
  );
});

// cek status koneksi
app.get("/health", (req, res) => {
  const state = client.info ? "1" : "0";
  res.status(state === "1" ? 200 : 503).json({
    s: state,
  });
});

// peladen standby menunggu perintah
server.listen(port, function () {
  console.log("App running on *: " + port);
});

// sesungguhnya kita adalah milik tuhan.
// dan kepada-Nya kita kembali.
process.on("SIGINT", () => {
  console.log("Closing database connection...");
  db.close();
  process.exit(0);
});

import Database from 'better-sqlite3'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const db = new Database(join(__dirname, 'visionfarm.db'))
db.pragma('journal_mode = WAL')

db.exec(`
  CREATE TABLE IF NOT EXISTS inquiries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    company TEXT,
    project_type TEXT,
    budget TEXT,
    message TEXT,
    status TEXT DEFAULT 'NEW',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS subscribers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    source TEXT DEFAULT 'website',
    subscribed INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS emails_sent (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recipient TEXT NOT NULL,
    template TEXT NOT NULL,
    subject TEXT,
    status TEXT DEFAULT 'sent',
    sent_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sms_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone TEXT NOT NULL,
    direction TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS ig_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id TEXT NOT NULL,
    message TEXT,
    reply TEXT,
    intent TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS drip_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL,
    name TEXT,
    template TEXT NOT NULL,
    send_at TEXT NOT NULL,
    sent INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );
`)

export const insertInquiry = db.prepare(`
  INSERT INTO inquiries (name, email, company, project_type, budget, message)
  VALUES (@name, @email, @company, @project_type, @budget, @message)
`)

export const insertSubscriber = db.prepare(`
  INSERT INTO subscribers (email, name, source)
  VALUES (@email, @name, @source)
  ON CONFLICT(email) DO UPDATE SET
    name = COALESCE(@name, subscribers.name)
`)

export const getAllSubscribers = db.prepare(
  'SELECT * FROM subscribers WHERE subscribed = 1 ORDER BY created_at DESC'
)

export const logEmail = db.prepare(`
  INSERT INTO emails_sent (recipient, template, subject, status)
  VALUES (@recipient, @template, @subject, @status)
`)

export const logSms = db.prepare(`
  INSERT INTO sms_log (phone, direction, body)
  VALUES (@phone, @direction, @body)
`)

export const logIgMessage = db.prepare(`
  INSERT INTO ig_messages (sender_id, message, reply, intent)
  VALUES (@sender_id, @message, @reply, @intent)
`)

export const enqueueDrip = db.prepare(`
  INSERT INTO drip_queue (email, name, template, send_at)
  VALUES (@email, @name, @template, @send_at)
`)

export const getPendingDrips = db.prepare(
  'SELECT * FROM drip_queue WHERE sent = 0 AND send_at <= datetime(\'now\')'
)

export const markDripSent = db.prepare('UPDATE drip_queue SET sent = 1 WHERE id = ?')

export const getStats = () => {
  const inquiries = db.prepare('SELECT COUNT(*) as count FROM inquiries').get()
  const subscribers = db.prepare('SELECT COUNT(*) as count FROM subscribers WHERE subscribed = 1').get()
  const emails = db.prepare('SELECT COUNT(*) as count FROM emails_sent').get()
  return { totalInquiries: inquiries.count, totalSubscribers: subscribers.count, totalEmailsSent: emails.count }
}

export default db

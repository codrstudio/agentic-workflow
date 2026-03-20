import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, '..', 'data');
mkdirSync(dataDir, { recursive: true });

const db = new Database(join(dataDir, 'agenda.db'));

// Enable WAL for better concurrency
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Migrations
db.exec(`
  CREATE TABLE IF NOT EXISTS therapists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    specialties TEXT DEFAULT '[]',
    photo_url TEXT,
    working_hours_start TEXT DEFAULT '08:00',
    working_hours_end TEXT DEFAULT '18:00',
    session_duration INTEGER DEFAULT 60,
    session_interval INTEGER DEFAULT 0,
    setup_complete INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS clinic_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    clinic_name TEXT NOT NULL DEFAULT '',
    address TEXT NOT NULL DEFAULT '',
    timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    currency TEXT NOT NULL DEFAULT 'BRL',
    logo_url TEXT DEFAULT NULL,
    updated_at TEXT DEFAULT (datetime('now'))
  );

  INSERT OR IGNORE INTO clinic_settings (id, clinic_name, address, timezone, currency)
  VALUES (1, '', '', 'America/Sao_Paulo', 'BRL');

  CREATE TABLE IF NOT EXISTS patients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    therapist_id INTEGER NOT NULL REFERENCES therapists(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    telefone TEXT,
    email TEXT,
    data_nascimento TEXT,
    notas TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS availability (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    therapist_id INTEGER NOT NULL REFERENCES therapists(id) ON DELETE CASCADE,
    dia_semana INTEGER NOT NULL CHECK (dia_semana >= 0 AND dia_semana <= 6),
    hora_inicio TEXT NOT NULL,
    hora_fim TEXT NOT NULL,
    ativo INTEGER NOT NULL DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS availability_override (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    therapist_id INTEGER NOT NULL REFERENCES therapists(id) ON DELETE CASCADE,
    data TEXT NOT NULL,
    tipo TEXT NOT NULL CHECK (tipo IN ('bloqueio', 'liberacao')),
    hora_inicio TEXT,
    hora_fim TEXT,
    descricao TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS services (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    therapist_id INTEGER NOT NULL REFERENCES therapists(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    duracao INTEGER NOT NULL DEFAULT 60,
    descricao TEXT,
    preco REAL NOT NULL DEFAULT 0,
    ativo INTEGER NOT NULL DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS appointments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    therapist_id INTEGER NOT NULL REFERENCES therapists(id) ON DELETE CASCADE,
    patient_id INTEGER REFERENCES patients(id) ON DELETE SET NULL,
    datetime TEXT NOT NULL,
    duration INTEGER NOT NULL DEFAULT 60,
    status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'confirmed', 'completed', 'cancelled', 'no_show')),
    notes TEXT,
    created_by TEXT DEFAULT 'therapist',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS clinic_page (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    therapist_id INTEGER NOT NULL UNIQUE REFERENCES therapists(id) ON DELETE CASCADE,
    slug TEXT NOT NULL DEFAULT '',
    descricao TEXT DEFAULT '',
    foto_capa TEXT DEFAULT NULL,
    servicos_visiveis TEXT NOT NULL DEFAULT '[]',
    ativa INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    appointment_id INTEGER NOT NULL UNIQUE REFERENCES appointments(id) ON DELETE CASCADE,
    booking_token TEXT NOT NULL UNIQUE,
    patient_name TEXT NOT NULL,
    patient_phone TEXT NOT NULL,
    patient_email TEXT,
    aceite_politica INTEGER NOT NULL DEFAULT 0,
    criado_via TEXT NOT NULL DEFAULT 'online',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS notification_settings (
    therapist_id INTEGER PRIMARY KEY REFERENCES therapists(id) ON DELETE CASCADE,
    enabled INTEGER NOT NULL DEFAULT 1,
    reminder_48h INTEGER NOT NULL DEFAULT 1,
    reminder_24h INTEGER NOT NULL DEFAULT 1,
    reminder_2h INTEGER NOT NULL DEFAULT 1,
    confirmation_request INTEGER NOT NULL DEFAULT 1,
    canal TEXT NOT NULL DEFAULT 'email',
    custom_message TEXT DEFAULT NULL,
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    appointment_id INTEGER NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
    patient_id INTEGER REFERENCES patients(id) ON DELETE SET NULL,
    tipo TEXT NOT NULL CHECK (tipo IN ('reminder_48h', 'reminder_24h', 'reminder_2h', 'confirmation_request', 'custom')),
    canal TEXT NOT NULL DEFAULT 'email',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'failed')),
    scheduled_at TEXT NOT NULL,
    sent_at TEXT DEFAULT NULL,
    error_message TEXT DEFAULT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(appointment_id, tipo)
  );
`);

// Incremental migrations — safe to run on existing DBs
try { db.exec(`ALTER TABLE notification_settings ADD COLUMN reminder_24h INTEGER NOT NULL DEFAULT 1`); } catch (_) {}

// Migrate notifications table to include reminder_24h in tipo CHECK constraint (if not already)
{
  const row = db.prepare("SELECT sql FROM sqlite_master WHERE name='notifications'").get();
  if (row && !row.sql.includes('reminder_24h')) {
    db.exec(`
      PRAGMA foreign_keys = OFF;
      CREATE TABLE notifications_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        appointment_id INTEGER NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
        patient_id INTEGER REFERENCES patients(id) ON DELETE SET NULL,
        tipo TEXT NOT NULL CHECK (tipo IN ('reminder_48h', 'reminder_24h', 'reminder_2h', 'confirmation_request', 'custom')),
        canal TEXT NOT NULL DEFAULT 'email',
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'failed')),
        scheduled_at TEXT NOT NULL,
        sent_at TEXT DEFAULT NULL,
        error_message TEXT DEFAULT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        UNIQUE(appointment_id, tipo)
      );
      INSERT INTO notifications_new SELECT * FROM notifications;
      DROP TABLE notifications;
      ALTER TABLE notifications_new RENAME TO notifications;
      PRAGMA foreign_keys = ON;
    `);
  }
}

export default db;

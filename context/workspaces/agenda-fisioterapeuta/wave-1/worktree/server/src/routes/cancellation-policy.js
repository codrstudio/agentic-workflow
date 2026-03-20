import { Router } from 'express';
import db from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

function ensurePolicy(therapistId) {
  const existing = db
    .prepare('SELECT therapist_id FROM cancellation_policy WHERE therapist_id = ?')
    .get(therapistId);
  if (!existing) {
    db.prepare(`
      INSERT INTO cancellation_policy (therapist_id, janela_horas, taxa_noshow, mensagem, ativa)
      VALUES (?, 24, 0, NULL, 1)
    `).run(therapistId);
  }
}

// GET /cancellation-policy
router.get('/', (req, res) => {
  const therapistId = req.therapistId;
  ensurePolicy(therapistId);
  const policy = db
    .prepare('SELECT * FROM cancellation_policy WHERE therapist_id = ?')
    .get(therapistId);
  res.json(policy);
});

// PUT /cancellation-policy
router.put('/', (req, res) => {
  const therapistId = req.therapistId;
  ensurePolicy(therapistId);

  const { janela_horas, taxa_noshow, mensagem, ativa } = req.body;

  // Validation
  if (janela_horas !== undefined) {
    const horas = Number(janela_horas);
    if (!Number.isInteger(horas) || horas <= 0) {
      return res.status(400).json({ error: 'janela_horas deve ser um número inteiro positivo' });
    }
  }
  if (taxa_noshow !== undefined) {
    const taxa = Number(taxa_noshow);
    if (isNaN(taxa) || taxa < 0 || taxa > 100) {
      return res.status(400).json({ error: 'taxa_noshow deve ser um número entre 0 e 100' });
    }
  }

  db.prepare(`
    UPDATE cancellation_policy
    SET
      janela_horas = COALESCE(?, janela_horas),
      taxa_noshow = COALESCE(?, taxa_noshow),
      mensagem = CASE WHEN ? IS NOT NULL THEN ? ELSE mensagem END,
      ativa = COALESCE(?, ativa),
      updated_at = datetime('now')
    WHERE therapist_id = ?
  `).run(
    janela_horas !== undefined ? Number(janela_horas) : null,
    taxa_noshow !== undefined ? Number(taxa_noshow) : null,
    mensagem !== undefined ? mensagem : null,
    mensagem !== undefined ? mensagem : null,
    ativa !== undefined ? (ativa ? 1 : 0) : null,
    therapistId
  );

  const updated = db
    .prepare('SELECT * FROM cancellation_policy WHERE therapist_id = ?')
    .get(therapistId);
  res.json(updated);
});

export default router;

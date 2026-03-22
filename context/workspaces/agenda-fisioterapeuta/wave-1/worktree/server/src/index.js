import express from 'express';
import cors from 'cors';
import authRouter from './routes/auth.js';
import clinicRouter from './routes/clinic.js';
import therapistRouter from './routes/therapist.js';
import patientsRouter from './routes/patients.js';
import availabilityRouter from './routes/availability.js';
import slotsRouter from './routes/slots.js';
import appointmentsRouter from './routes/appointments.js';
import servicesRouter from './routes/services.js';
import clinicPageRouter from './routes/clinic-page.js';
import publicRouter from './routes/public.js';
import notificationsRouter from './routes/notifications.js';
import cancellationPolicyRouter from './routes/cancellation-policy.js';
import waitlistRouter from './routes/waitlist.js';
import paymentsRouter from './routes/payments.js';
import financialRouter from './routes/financial.js';
import { requireAuth } from './middleware/auth.js';
import { startScheduler } from './notification-engine.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
}));
app.use(express.json());

// Public routes
app.use('/auth', authRouter);
app.use('/public', publicRouter);

// Protected routes
app.use('/clinic', clinicRouter);
app.use('/therapist', therapistRouter);
app.use('/patients', patientsRouter);
app.use('/availability', availabilityRouter);
app.use('/slots', slotsRouter);
app.use('/appointments', appointmentsRouter);
app.use('/services', servicesRouter);
app.use('/clinic-page', clinicPageRouter);
app.use('/notifications', notificationsRouter);
app.use('/cancellation-policy', cancellationPolicyRouter);
app.use('/waitlist', waitlistRouter);
app.use('/payments', paymentsRouter);
app.use('/financial', financialRouter);

// Health check
app.get('/health', (req, res) => res.json({ ok: true }));

// Protected route example (for testing middleware)
app.get('/api/protected', requireAuth, (req, res) => {
  res.json({ message: 'Rota protegida acessada com sucesso', therapistId: req.therapistId });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  startScheduler();
});

export default app;

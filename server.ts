import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import { createServer as createViteServer } from 'vite';
import jwt from 'jsonwebtoken';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const JWT_SECRET = process.env.JWT_SECRET || 'ssa-secret-key-12345';
const ADMIN_PASSWORD = 'Dhanush9559';

// Supabase Initialization
let supabaseClient: any = null;

const getSupabase = () => {
  if (!supabaseClient) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY environment variables are required');
    }
    
    supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
  }
  return supabaseClient;
};

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  app.use(cookieParser());

  // Auth Middleware
  const authenticate = (req: Request, res: Response, next: NextFunction) => {
    const token = req.cookies.ssa_token;
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    try {
      jwt.verify(token, JWT_SECRET);
      next();
    } catch (err) {
      res.status(401).json({ error: 'Invalid token' });
    }
  };

  // API Routes
  app.post('/api/login', (req, res) => {
    const { password } = req.body;

    if (password === ADMIN_PASSWORD) {
      const token = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '24h' });
      
      res.cookie('ssa_token', token, {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
      });

      return res.json({ success: true });
    }

    return res.status(401).json({ success: false, message: 'Invalid password' });
  });

  app.get('/api/check-auth', (req, res) => {
    const token = req.cookies.ssa_token;

    if (!token) {
      return res.json({ authenticated: false });
    }

    try {
      jwt.verify(token, JWT_SECRET);
      return res.json({ authenticated: true });
    } catch (err) {
      return res.json({ authenticated: false });
    }
  });

  app.post('/api/logout', (req, res) => {
    res.clearCookie('ssa_token', {
      httpOnly: true,
      secure: true,
      sameSite: 'none'
    });
    res.json({ success: true });
  });

  // Inventory Endpoints
  app.get('/api/inventory', async (req, res) => {
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase.from('inventory').select('*');
      if (error) return res.status(500).json({ error: error.message });
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/inventory', authenticate, async (req, res) => {
    try {
      const supabase = getSupabase();
      const { id, name, price } = req.body;
      const { data, error } = await supabase.from('inventory').upsert({ id, name, price }).select();
      if (error) return res.status(500).json({ error: error.message });
      res.json(data[0]);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/inventory/:id', authenticate, async (req, res) => {
    try {
      const supabase = getSupabase();
      const { id } = req.params;
      const { error } = await supabase.from('inventory').delete().eq('id', id);
      if (error) return res.status(500).json({ error: error.message });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // History Endpoints
  app.get('/api/history', async (req, res) => {
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase.from('history').select('*').order('date', { ascending: false });
      if (error) return res.status(500).json({ error: error.message });
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/history', async (req, res) => {
    try {
      const supabase = getSupabase();
      const invoice = req.body;
      const { data, error } = await supabase.from('history').insert(invoice).select();
      if (error) return res.status(500).json({ error: error.message });
      res.json(data[0]);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/history/:id', authenticate, async (req, res) => {
    try {
      const supabase = getSupabase();
      const { id } = req.params;
      const { error } = await supabase.from('history').delete().eq('id', id);
      if (error) return res.status(500).json({ error: error.message });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

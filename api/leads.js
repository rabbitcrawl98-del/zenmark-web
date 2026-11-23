const { z } = require('zod');
const { createClient } = require('@supabase/supabase-js');

// Strict Lead Boundary Schema
const leadSchema = z.object({
  name: z.string({ required_error: 'name is required' }).min(2, 'Name must be at least 2 characters'),
  phone: z.string().optional(),
  email: z.string().email('Invalid email address format').optional(),
  region: z.string().optional(),
  plan: z.string().optional(),
  service: z.string().optional()
}).strict({ message: 'Unrecognized key in payload boundary' });

module.exports = async function handler(req, res) {
  // Enable CORS for allowed origins
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Expected POST.' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (parseErr) {
        return res.status(400).json({
          error: 'Failed to record lead',
          message: parseErr.message
        });
      }
    }

    const parseResult = leadSchema.safeParse(body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Invalid payload boundary',
        details: parseResult.error.issues
      });
    }

    const validatedData = parseResult.data;

    // Optional Supabase Persistence (if configured)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseKey) {
      try {
        const supabase = createClient(supabaseUrl, supabaseKey);
        await supabase.from('leads').insert([{
          name: validatedData.name,
          region: validatedData.region || null,
          plan: validatedData.plan || null,
          service: validatedData.service || null,
          email: validatedData.email || null,
          phone: validatedData.phone || null,
          created_at: new Date().toISOString()
        }]);
      } catch (dbErr) {
        console.warn('Database ingestion fallback note:', dbErr.message);
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Lead recorded and staged for WhatsApp speed-to-lead handoff'
    });
  } catch (err) {
    console.error('Unhandled serverless lead capture exception:', err);
    return res.status(500).json({
      error: 'Internal server error while recording lead'
    });
  }
};

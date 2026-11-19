import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3001),
  SUPABASE_URL: z.string().url().default('https://placeholder.supabase.co'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).default('placeholder-service-key'),
  SUPABASE_ANON_KEY: z.string().min(1).default('placeholder-anon-key'),
  CLIENT_URL: z.string().default('http://localhost:5173'),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error('[Config] Invalid environment variables:');
    console.error(parsed.error.format());
    process.exit(1);
  }
  if (parsed.data.SUPABASE_URL === 'https://placeholder.supabase.co') {
    console.warn('[Config] WARNING: Using placeholder Supabase URL. Set SUPABASE_URL in .env');
  }
  return parsed.data;
}

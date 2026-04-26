import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim().replace(/\/$/, "");
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

const isPlaceholder = supabaseUrl?.includes('your-project.supabase.co');
const isValidUrl = supabaseUrl?.startsWith('https://');
const isConfigured = Boolean(supabaseUrl && supabaseAnonKey && !isPlaceholder && isValidUrl);

const CONFIG_ERROR_MSG = `Supabase is not correctly configured. 
1. Go to the "Secrets" panel in the sidebar.
2. Add VITE_SUPABASE_URL (should start with https://)
3. Add VITE_SUPABASE_ANON_KEY
4. If you just added them, refresh the page.

Current URL: ${supabaseUrl || 'Not set'}
Status: ${!supabaseUrl ? 'URL Missing' : isPlaceholder ? 'Placeholder detected' : !isValidUrl ? 'Invalid URL format' : 'Configured'}`;

// Only initialize if we have the credentials to avoid crashing on boot.
// If not configured, we return a Proxy that throws a clear error when accessed.
export const supabase = isConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : new Proxy({}, {
      get: (_, prop) => {
        if (prop === 'auth') {
          return new Proxy({}, {
            get: () => () => {
              console.error(CONFIG_ERROR_MSG);
              return Promise.resolve({ data: { session: null }, error: { message: CONFIG_ERROR_MSG } });
            }
          });
        }
        return () => {
          throw new Error(CONFIG_ERROR_MSG);
        };
      }
    }) as any;

export const handleSupabaseError = (error: any) => {
  const message = error?.message || String(error || '');
  if (
    message.toLowerCase().includes('fetch') || 
    message.toLowerCase().includes('network') ||
    message.toLowerCase().includes('load') ||
    message.toLowerCase().includes('connection')
  ) {
    return 'CONNECTION_ERROR: Failed to connect to SevaSetu database. This usually means your Supabase project is PAUSED or your network is blocking the request. Please check if your project is active and that your URL is correct in the Secrets panel.';
  }
  return message || 'An unexpected error occurred';
};

export const testConnection = async () => {
  try {
    const { error: profileError } = await supabase.from('profiles').select('id, verification_status').limit(1);
    if (profileError) {
      if (profileError.code === '42703') { // Column does not exist
        return { success: false, error: 'The "profiles" table is missing required columns (verification_status, etc.). Please run the updated SQL setup script.' };
      }
      throw profileError;
    }

    const { error: needError } = await supabase.from('needs').select('is_deleted').limit(1);
    if (needError) {
      if (needError.code === '42703') { // Column does not exist
        return { success: false, error: 'The "needs" table is missing required columns for soft delete (is_deleted, deleted_at, auto_delete_at). Please run the SQL setup script.' };
      }
    }

    const { error: notifError } = await supabase.from('notifications').select('task_id').limit(1);
    if (notifError) {
      if (notifError.code === '42703') { // Column does not exist
        return { success: false, error: 'The "notifications" table is missing the "task_id" column. Please run the updated SQL setup script.' };
      }
    }

    return { success: true };
  } catch (error: any) {
    console.error('Supabase connection test failed:', error);
    return { success: false, error: handleSupabaseError(error) };
  }
};

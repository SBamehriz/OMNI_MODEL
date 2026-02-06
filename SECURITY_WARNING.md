# 🚨 SECURITY WARNING

## Exposed Credentials Detected

During security audit on 2026-02-06, the following credentials were found in `apps/api/.env`:

### IMMEDIATE ACTION REQUIRED

1. **Rotate Supabase Service Key**
   - Go to Supabase Dashboard → Settings → API
   - Generate new service role key
   - Update production environment variables

2. **Rotate Google API Key**
   - Go to Google Cloud Console → APIs & Services → Credentials
   - Delete key: `[REDACTED]`
   - Generate new API key with restricted scope
   - Update production environment variables

3. **Review Other Keys**
   - Check if OpenAI, Anthropic, OpenRouter, Groq keys need rotation
   - Verify no other credentials are exposed

## Status

- `.env` file: ✅ Already in `.gitignore`
- Git history: ✅ No `.env` found in commits
- Current risk: ⚠️ Local file contains real keys

## Next Steps

After rotating keys:
- [ ] Update local `.env` with new keys
- [ ] Update production deployment with new keys
- [ ] Verify all services still work
- [ ] Delete this file once resolved

## Prevention

✅ Implemented bcrypt for API key hashing
✅ Environment validation at startup
✅ Never commit `.env` files (already in .gitignore)

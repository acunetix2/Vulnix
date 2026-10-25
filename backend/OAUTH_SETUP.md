# OAuth Setup Guide for Vulnix

## Supabase OAuth Configuration

### 1. Enable OAuth Providers in Supabase

Go to your Supabase Dashboard:
1. Navigate to **Authentication** → **Providers**
2. Enable the providers you want (GitHub, Google, etc.)

### 2. Configure Redirect URLs

#### For GitHub:
1. Go to **GitHub Settings** → **Developer settings** → **OAuth Apps**
2. Create a new OAuth App or edit existing one
3. Set these URLs:
   - **Homepage URL**: `http://localhost:5174` (for dev)
   - **Authorization callback URL**: `https://hizseofgjynbufusyhuy.supabase.co/auth/v1/callback`
4. Copy the **Client ID** and **Client Secret**
5. In Supabase, go to **Authentication** → **Providers** → **GitHub**
   - Paste Client ID and Client Secret
   - Enable the provider

#### For Google:
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Go to **APIs & Services** → **Credentials**
4. Create **OAuth 2.0 Client ID**
5. Set these URLs:
   - **Authorized JavaScript origins**: `http://localhost:5174`, `https://your-domain.com`
   - **Authorized redirect URIs**: `https://hizseofgjynbufusyhuy.supabase.co/auth/v1/callback`
6. Copy the **Client ID** and **Client Secret**
7. In Supabase, go to **Authentication** → **Providers** → **Google**
   - Paste Client ID and Client Secret
   - Enable the provider

### 3. Configure Site URL and Redirect URLs in Supabase

In Supabase Dashboard → **Authentication** → **URL Configuration**:

1. **Site URL**: `http://localhost:5174` (for development)
2. **Redirect URLs**: Add these URLs (one per line):
   ```
   http://localhost:5174/auth/callback
   http://localhost:5173/auth/callback
   https://your-production-domain.com/auth/callback
   ```

### 4. Test OAuth Flow

1. Start the backend: `cd backend && uvicorn app.main:app --reload`
2. Start the frontend: `cd frontend && npm run dev`
3. Navigate to `http://localhost:5174/signin`
4. Click "Continue with GitHub" or "Continue with Google"
5. You should be redirected to the OAuth provider
6. After authorizing, you should be redirected back to `/auth/callback`
7. The callback page will exchange the code for tokens and redirect to `/dashboard`

## Troubleshooting

### Common Issues:

1. **"redirect_uri mismatch"**
   - Make sure the redirect URI in Supabase settings matches exactly: `http://localhost:5174/auth/callback`
   - No trailing slashes
   - Check both the OAuth provider settings AND Supabase settings

2. **"Invalid grant: user not found"**
   - The OAuth provider hasn't been properly configured in Supabase
   - Check that Client ID and Secret are correct

3. **"Failed to exchange code"** or **"Invalid PKCE code"**
   - The authorization code might have expired (they're single-use and short-lived)
   - Try the flow again from the beginning
   - Check that the Supabase redirect URLs are configured correctly
   - Verify that the OAuth provider (GitHub/Google) callback URL points to Supabase, not your app

4. **CORS errors**
   - Make sure your frontend URL is in the Supabase allowed origins
   - Check Supabase Dashboard → **API Settings** → **CORS allowed origins**

5. **OAuth providers not enabled**
   - In Supabase Dashboard → **Authentication** → **Providers**
   - Make sure GitHub/Google are **enabled** (toggle switch on)
   - Client ID and Client Secret must be saved

### Debug Mode

To see detailed OAuth errors, check:
1. **Browser DevTools** → Network tab → Look for:
   - `/api/v1/auth/oauth/init` - Should return `authorization_url`
   - Request to Supabase authorize URL
   - Redirect back to `/auth/callback?code=...`
   - `/api/v1/auth/oauth/callback` - Look for error responses
2. **Backend logs** (FastAPI terminal) - Will show detailed Supabase error messages
3. **Browser console** - Check for JavaScript errors or toast messages
4. **Check URL parameters** - When redirected back, you should see `?code=...` in the URL

### Step-by-Step Debug Process

If OAuth is failing:

1. **Check environment variables** in `backend/.env`:
   ```bash
   VULNIX_SUPABASE_URL=https://hizseofgjynbufusyhuy.supabase.co
   VULNIX_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

2. **Test the init endpoint manually**:
   ```bash
   curl -X POST http://localhost:8000/api/v1/auth/oauth/init \
     -H "Content-Type: application/json" \
     -d '{"provider": "github", "redirect_uri": "http://localhost:5174/auth/callback"}'
   ```
   Should return: `{"authorization_url": "https://...", "provider": "github"}`

3. **Check Supabase Dashboard**:
   - Authentication → Providers → GitHub (or Google) should show "Enabled"
   - Authentication → URL Configuration → Should have `http://localhost:5174/auth/callback` in Redirect URLs

4. **Try OAuth flow**:
   - Click "Continue with GitHub" on sign-in page
   - Should redirect to GitHub authorization page
   - After approval, should redirect to `http://localhost:5174/auth/callback?code=...`
   - Check browser console and backend logs for any errors

5. **If code exchange fails**, the backend will log the exact Supabase error - check your terminal

## Current Configuration

- **Supabase URL**: `https://hizseofgjynbufusyhuy.supabase.co`
- **Frontend (dev)**: `http://localhost:5174`
- **Backend (dev)**: `http://localhost:8000`
- **Callback URL**: `http://localhost:5174/auth/callback`

## Production Deployment

For production, update:
1. Site URL in Supabase to your production domain
2. Add production redirect URLs
3. Update OAuth provider callback URLs to use production Supabase URL
4. Ensure HTTPS is enforced

# OAuth Setup Checklist

Complete these steps in order to enable OAuth for Vulnix.

## ✅ Already Done

- [x] Backend OAuth endpoints implemented
- [x] Environment variables configured
- [x] Supabase connection verified
- [x] Frontend OAuth buttons implemented
- [x] AuthCallback page created

## 🔧 Configuration Required (Do These Now)

### Step 1: Create GitHub OAuth App

- [ ] Go to: https://github.com/settings/developers
- [ ] Click **"New OAuth App"**
- [ ] Fill in the form:
  - [ ] Application name: `Vulnix (Dev)`
  - [ ] Homepage URL: `http://localhost:5174`
  - [ ] Authorization callback URL: `https://hizseofgjynbufusyhuy.supabase.co/auth/v1/callback`
- [ ] Click **"Register application"**
- [ ] Copy the **Client ID** (save it for next step)
- [ ] Click **"Generate a new client secret"**
- [ ] Copy the **Client Secret** (save it for next step)

### Step 2: Configure GitHub in Supabase

- [ ] Go to: https://app.supabase.com
- [ ] Select your Vulnix project
- [ ] Navigate to: **Authentication** → **Providers**
- [ ] Find **GitHub** in the list
- [ ] Click to expand GitHub settings
- [ ] Toggle **"GitHub Enabled"** to **ON**
- [ ] Paste the **Client ID** from Step 1
- [ ] Paste the **Client Secret** from Step 1
- [ ] Click **"Save"** at the bottom

### Step 3: Create Google OAuth Client

- [ ] Go to: https://console.cloud.google.com
- [ ] Select or create a project
- [ ] Navigate to: **APIs & Services** → **Credentials**
- [ ] Click **"Create Credentials"** → **"OAuth client ID"**
- [ ] If prompted, configure the OAuth consent screen first
- [ ] Application type: **Web application**
- [ ] Name: `Vulnix (Dev)`
- [ ] Under **Authorized JavaScript origins**, click **"Add URI"**:
  - [ ] Add: `http://localhost:5174`
  - [ ] Add: `https://hizseofgjynbufusyhuy.supabase.co`
- [ ] Under **Authorized redirect URIs**, click **"Add URI"**:
  - [ ] Add: `https://hizseofgjynbufusyhuy.supabase.co/auth/v1/callback`
- [ ] Click **"Create"**
- [ ] Copy the **Client ID** (save it for next step)
- [ ] Copy the **Client Secret** (save it for next step)

### Step 4: Configure Google in Supabase

- [ ] Go to: https://app.supabase.com
- [ ] Select your Vulnix project
- [ ] Navigate to: **Authentication** → **Providers**
- [ ] Find **Google** in the list
- [ ] Click to expand Google settings
- [ ] Toggle **"Google Enabled"** to **ON**
- [ ] Paste the **Client ID** from Step 3
- [ ] Paste the **Client Secret** from Step 3
- [ ] Click **"Save"** at the bottom

### Step 5: Configure Redirect URLs in Supabase

- [ ] Still in Supabase Dashboard
- [ ] Navigate to: **Authentication** → **URL Configuration**
- [ ] Under **Site URL**, enter: `http://localhost:5174`
- [ ] Under **Redirect URLs**, add these URLs (one per line):
  - [ ] `http://localhost:5174/auth/callback`
  - [ ] `http://localhost:5173/auth/callback`
- [ ] Click **"Save"**

## 🧪 Testing

### Step 6: Verify Configuration

- [ ] Open terminal in `backend` folder
- [ ] Run: `python test_oauth.py`
- [ ] Verify all checks pass (green checkmarks)

### Step 7: Start Servers

**Terminal 1:**
- [ ] `cd backend`
- [ ] `uvicorn app.main:app --reload --port 8000`
- [ ] Wait until you see "Application startup complete"

**Terminal 2:**
- [ ] `cd frontend`
- [ ] `npm run dev`
- [ ] Note the port (should be 5174)

### Step 8: Test OAuth Flow

**GitHub:**
- [ ] Open browser to: http://localhost:5174/signin
- [ ] Click **"Continue with GitHub"**
- [ ] Verify redirect to GitHub authorization page
- [ ] Click **"Authorize"** on GitHub
- [ ] Verify redirect back to Vulnix
- [ ] Verify success toast message appears
- [ ] Verify you're logged in to dashboard

**Google:**
- [ ] Go back to: http://localhost:5174/signin (or logout first)
- [ ] Click **"Continue with Google"**
- [ ] Verify redirect to Google authorization page
- [ ] Select your Google account
- [ ] Click **"Continue"** or **"Allow"**
- [ ] Verify redirect back to Vulnix
- [ ] Verify success toast message appears
- [ ] Verify you're logged in to dashboard

## 🐛 Troubleshooting

If OAuth fails, check:

- [ ] Backend logs (Terminal 1) for error messages
- [ ] Browser console (F12) for JavaScript errors
- [ ] Network tab (F12) for failed API requests
- [ ] Verify provider toggles are **ON** in Supabase
- [ ] Verify Client IDs and Secrets are saved in Supabase
- [ ] Verify no typos in callback URLs (no trailing slashes)

**Common issues:**

| Error | Cause | Fix |
|-------|-------|-----|
| `redirect_uri mismatch` | Redirect URL not in Supabase settings | Add `http://localhost:5174/auth/callback` to Supabase URL Configuration |
| `Invalid client` | Wrong Client ID/Secret | Re-check credentials in Supabase Providers |
| `Invalid grant` | Provider not enabled | Toggle provider to ON in Supabase |
| `Authorization code expired` | Code used twice or expired | Try OAuth flow again from start |

## 📚 Additional Resources

- **Detailed Setup Guide**: `backend/OAUTH_SETUP.md`
- **Fix Summary**: `OAUTH_FIX_SUMMARY.md`
- **Test Script**: `backend/test_oauth.py`

---

**Important URLs:**

- Supabase Dashboard: https://app.supabase.com
- GitHub OAuth Apps: https://github.com/settings/developers
- Google Cloud Console: https://console.cloud.google.com

**Your Supabase URL:** `https://hizseofgjynbufusyhuy.supabase.co`

---

Once all checkboxes are checked, OAuth should work perfectly! 🎉

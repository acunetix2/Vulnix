#!/usr/bin/env python3
"""
Quick OAuth configuration test script.
Run this to verify your Supabase OAuth setup without starting the full app.

Usage: python test_oauth.py
"""

import os
import sys
from pathlib import Path

# Add parent directory to path to import app modules
sys.path.insert(0, str(Path(__file__).parent))

from dotenv import load_dotenv

# Load environment variables
load_dotenv()


def test_env_vars():
    """Check that required environment variables are set."""
    print("=" * 60)
    print("1. Checking Environment Variables")
    print("=" * 60)
    
    supabase_url = os.getenv("VULNIX_SUPABASE_URL")
    supabase_key = os.getenv("VULNIX_SUPABASE_ANON_KEY")
    
    if not supabase_url:
        print("❌ VULNIX_SUPABASE_URL is not set in .env")
        return False
    else:
        print(f"✅ VULNIX_SUPABASE_URL: {supabase_url}")
    
    if not supabase_key:
        print("❌ VULNIX_SUPABASE_ANON_KEY is not set in .env")
        return False
    else:
        # Show only first/last few characters for security
        masked_key = f"{supabase_key[:20]}...{supabase_key[-10:]}"
        print(f"✅ VULNIX_SUPABASE_ANON_KEY: {masked_key}")
    
    return True


def test_oauth_url_generation():
    """Test OAuth URL generation."""
    print("\n" + "=" * 60)
    print("2. Testing OAuth URL Generation")
    print("=" * 60)
    
    supabase_url = os.getenv("VULNIX_SUPABASE_URL")
    redirect_uri = "http://localhost:5174/auth/callback"
    
    for provider in ["github", "google"]:
        auth_url = f"{supabase_url}/auth/v1/authorize?provider={provider}&redirect_to={redirect_uri}"
        print(f"\n{provider.capitalize()} OAuth URL:")
        print(f"  {auth_url}")


def test_supabase_connection():
    """Test connection to Supabase."""
    print("\n" + "=" * 60)
    print("3. Testing Supabase Connection")
    print("=" * 60)
    
    try:
        import httpx
    except ImportError:
        print("❌ httpx not installed. Run: pip install httpx")
        return False
    
    supabase_url = os.getenv("VULNIX_SUPABASE_URL")
    supabase_key = os.getenv("VULNIX_SUPABASE_ANON_KEY")
    
    # Test basic connectivity
    try:
        import httpx
        with httpx.Client(timeout=10.0) as client:
            # Try to hit the health endpoint
            resp = client.get(
                f"{supabase_url}/auth/v1/health",
                headers={"apikey": supabase_key}
            )
            
            if resp.status_code == 200:
                print(f"✅ Supabase is reachable (status: {resp.status_code})")
                return True
            else:
                print(f"⚠️  Supabase responded with status: {resp.status_code}")
                print(f"   Response: {resp.text[:200]}")
                return False
                
    except Exception as e:
        print(f"❌ Failed to connect to Supabase: {e}")
        return False


def print_next_steps():
    """Print next steps for the user."""
    print("\n" + "=" * 60)
    print("Next Steps")
    print("=" * 60)
    print("""
To complete OAuth setup:

1. Go to Supabase Dashboard: https://app.supabase.com
   → Select your project
   → Authentication → Providers

2. Enable GitHub:
   - Create OAuth app at: https://github.com/settings/developers
   - Homepage URL: http://localhost:5174
   - Callback URL: https://hizseofgjynbufusyhuy.supabase.co/auth/v1/callback
   - Copy Client ID and Secret to Supabase

3. Enable Google:
   - Create OAuth client at: https://console.cloud.google.com
   - Authorized origins: http://localhost:5174
   - Authorized redirect URIs: https://hizseofgjynbufusyhuy.supabase.co/auth/v1/callback
   - Copy Client ID and Secret to Supabase

4. Configure Redirect URLs in Supabase:
   → Authentication → URL Configuration
   → Add: http://localhost:5174/auth/callback

5. Start the backend and frontend:
   cd backend && uvicorn app.main:app --reload
   cd frontend && npm run dev

6. Test OAuth by clicking "Continue with GitHub/Google" on sign-in page

For detailed instructions, see: backend/OAUTH_SETUP.md
""")


def main():
    """Run all tests."""
    print("\n")
    print("╔" + "═" * 58 + "╗")
    print("║" + " " * 15 + "Vulnix OAuth Test Script" + " " * 19 + "║")
    print("╚" + "═" * 58 + "╝")
    print()
    
    all_pass = True
    
    # Run tests
    if not test_env_vars():
        all_pass = False
    
    test_oauth_url_generation()
    
    if not test_supabase_connection():
        all_pass = False
    
    # Print summary
    print("\n" + "=" * 60)
    print("Summary")
    print("=" * 60)
    
    if all_pass:
        print("✅ All checks passed!")
        print("⚠️  OAuth providers still need to be configured in Supabase Dashboard")
    else:
        print("❌ Some checks failed. Fix the issues above before proceeding.")
    
    print_next_steps()


if __name__ == "__main__":
    main()

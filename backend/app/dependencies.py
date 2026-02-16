from supabase import create_client, Client
from app.config import get_settings

settings = get_settings()

def get_supabase() -> Client:
    """
    Creates and returns a Supabase client.
    This client is stateless and can be reused or created per request.
    Since 'gotrue' (auth) is stateful if used for session management, 
    but we are likely using it for data access mainly, a simple factory is fine.
    """
    supabase: Client = create_client(settings.supabase_url, settings.supabase_key)
    return supabase

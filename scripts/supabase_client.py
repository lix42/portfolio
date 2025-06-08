import os
from dotenv import load_dotenv
from supabase import create_client, Client

def get_supabase_client(use_remote: bool = False) -> Client:
    """
    Returns a Supabase client. Defaults to local instance unless use_remote=True.
    Requires .env with LOCAL_SUPABASE_URL, LOCAL_SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
    """
    load_dotenv()
    if use_remote:
        url = os.getenv('SUPABASE_URL')
        key = os.getenv('SUPABASE_KEY')
    else:
        url = os.getenv('LOCAL_SUPABASE_URL')
        key = os.getenv('LOCAL_SUPABASE_KEY')

    print(f"Connecting to {url} with key {key}")
    if not url or not key:
        raise ValueError("Missing Supabase URL or Service Role Key in .env for the selected instance.")
    return create_client(url, key)

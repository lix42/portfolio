# Usage:
#   python ingestCompanies.py [--remote]
#
# By default, connects to local Supabase instance using LOCAL_SUPABASE_URL and LOCAL_SUPABASE_SERVICE_ROLE_KEY from .env.
# If --remote is passed, connects to remote Supabase using SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env.

import os
import sys
import json
from dotenv import load_dotenv
from supabase import create_client, Client

# Load environment variables from .env
load_dotenv()

# Determine Supabase target
use_remote = '--remote' in sys.argv

if use_remote:
    url = os.getenv('SUPABASE_URL')
    key = os.getenv('SUPABASE_KEY')
else:
    url = os.getenv('LOCAL_SUPABASE_URL')
    key = os.getenv('LOCAL_SUPABASE_KEY')

if not url or not key:
    raise ValueError("Missing Supabase URL or Service Role Key in .env for the selected instance.")

print(f"Connecting to {url} with key {key}")

supabase: Client = create_client(url, key)

# Load company data from JSON
with open(os.path.join(os.path.dirname(__file__), '../documents/companies.json'), 'r') as f:
    companies = json.load(f)

for company in companies:
    # Map JSON fields to table columns
    data = {
        'name': company['company'],
        'start_time': company['startDate'],
        'end_time': company['endDate'],
        'title': company['title'],
        'description': company['description']
    }
    # Upsert: replace if (name, start_time) exists
    resp = supabase.table('companies').upsert(data, on_conflict='name, start_time').execute()
    if hasattr(resp, 'status_code') and resp.status_code >= 400:
        print(f"Error upserting {data['name']}: {resp}")
    else:
        print(f"Upserted: {data['name']}")

print("Ingestion complete.")
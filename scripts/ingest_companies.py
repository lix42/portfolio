# Usage:
#   python ingestCompanies.py [--remote]
#
# By default, connects to local Supabase instance using LOCAL_SUPABASE_URL and LOCAL_SUPABASE_SERVICE_ROLE_KEY from .env.
# If --remote is passed, connects to remote Supabase using SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env.

import sys
import json
import os
from supabase_client import get_supabase_client

# Determine Supabase target
use_remote = "--remote" in sys.argv

supabase = get_supabase_client(use_remote=use_remote)

# Load company data from JSON
with open(
    os.path.join(os.path.dirname(__file__), "../documents/companies.json"), "r"
) as f:
    companies = json.load(f)

for company in companies:
    # Map JSON fields to table columns
    data = {
        "name": company["company"],
        "start_time": company["startDate"],
        "end_time": company["endDate"],
        "title": company["title"],
        "description": company["description"],
    }
    # Upsert: replace if (name, start_time) exists
    resp = (
        supabase.table("companies")
        .upsert(data, on_conflict="name, start_time")
        .execute()
    )

    if hasattr(resp, 'status_code') and resp.status_code >= 400:
        print(f"Error upserting {data['name']}: {resp}")
    else:
        print(f"Upserted: {data['name']}")

print("Ingestion complete.")

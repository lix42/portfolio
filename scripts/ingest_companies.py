# Usage:
#   python ingest_companies.py [--remote]
#
# By default, connects to local Supabase instance using LOCAL_SUPABASE_URL and LOCAL_SUPABASE_SERVICE_ROLE_KEY from .env.
# If --remote is passed, connects to remote Supabase using SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env.

import sys
import json
import os
from datetime import date
from supabase_client import get_supabase_client
from supabase_data_access import SupabaseDataAccessProvider
from data_access import Company, DataAccessProvider

__all__ = ["ingest_companies"]


def ingest_companies(use_remote: bool = False, data_provider: DataAccessProvider = None) -> None:
    """
    Ingest company data from companies.json into database.
    
    Args:
        use_remote: If True, use remote Supabase instance. Otherwise use local.
        data_provider: Optional data access provider. If None, creates Supabase provider.
    """
    if data_provider is None:
        supabase = get_supabase_client(use_remote=use_remote)
        data_provider = SupabaseDataAccessProvider(supabase)

    # Load company data from JSON
    with open(
        os.path.join(os.path.dirname(__file__), "../documents/companies.json"), "r"
    ) as f:
        companies_data = json.load(f)

    for company_json in companies_data:
        # Create Company model from JSON
        company = Company(
            name=company_json["company"],
            start_time=date.fromisoformat(company_json["startDate"]) if company_json["startDate"] else None,
            end_time=date.fromisoformat(company_json["endDate"]) if company_json["endDate"] else None,
            title=company_json["title"],
            description=company_json["description"],
        )
        
        try:
            upserted_company = data_provider.companies.upsert_company(company)
            print(f"Upserted: {upserted_company.name}")
        except Exception as e:
            print(f"Error upserting {company.name}: {e}")

    print("Ingestion complete.")


if __name__ == "__main__":
    # Determine Supabase target
    use_remote = "--remote" in sys.argv
    ingest_companies(use_remote)

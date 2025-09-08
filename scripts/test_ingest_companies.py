"""
Unit tests for ingest_companies.py module.
Tests company data ingestion from JSON file.
"""

import os
import sys
import unittest
from unittest.mock import Mock, patch, mock_open
import json
from datetime import date

# Add scripts directory to path for imports
sys.path.insert(0, os.path.dirname(__file__))

from ingest_companies import ingest_companies
from fake_data_access import FakeDataAccessProvider
from data_access import Company


class TestIngestCompanies(unittest.TestCase):
    """Test the ingest_companies function."""

    def setUp(self):
        """Set up test fixtures."""
        self.fake_data_provider = FakeDataAccessProvider()
        self.fake_data_provider.clear_all()
        
        # Sample company data for testing
        self.sample_companies_data = [
            {
                "company": "TechCorp Inc",
                "startDate": "2020-01-15",
                "endDate": "2022-06-30",
                "title": "Senior Software Engineer",
                "description": "Developed web applications using Python and React"
            },
            {
                "company": "StartupXYZ",
                "startDate": "2022-07-01",
                "endDate": None,  # Current job
                "title": "Lead Developer",
                "description": "Leading development team on innovative projects"
            },
            {
                "company": "ConsultingFirm",
                "startDate": "2019-03-01",
                "endDate": "2019-12-31",
                "title": "Consultant",
                "description": "Provided technical consulting services"
            }
        ]

    def test_ingest_companies_success(self):
        """Test successful ingestion of company data."""
        json_data = json.dumps(self.sample_companies_data)
        
        with patch('builtins.open', mock_open(read_data=json_data)):
            ingest_companies(use_remote=False, data_provider=self.fake_data_provider)
        
        # Verify all companies were inserted
        for company_data in self.sample_companies_data:
            company = self.fake_data_provider.companies.get_company_by_name(company_data["company"])
            self.assertIsNotNone(company)
            self.assertEqual(company.name, company_data["company"])
            self.assertEqual(company.title, company_data["title"])
            self.assertEqual(company.description, company_data["description"])
            
            # Check dates
            if company_data["startDate"]:
                self.assertEqual(company.start_time, date.fromisoformat(company_data["startDate"]))
            else:
                self.assertIsNone(company.start_time)
                
            if company_data["endDate"]:
                self.assertEqual(company.end_time, date.fromisoformat(company_data["endDate"]))
            else:
                self.assertIsNone(company.end_time)

    def test_ingest_companies_with_null_dates(self):
        """Test ingestion when start/end dates are null."""
        companies_data = [
            {
                "company": "FlexCorp",
                "startDate": None,
                "endDate": None,
                "title": "Freelancer",
                "description": "Various freelance projects"
            }
        ]
        
        json_data = json.dumps(companies_data)
        
        with patch('builtins.open', mock_open(read_data=json_data)):
            ingest_companies(use_remote=False, data_provider=self.fake_data_provider)
        
        company = self.fake_data_provider.companies.get_company_by_name("FlexCorp")
        self.assertIsNotNone(company)
        self.assertIsNone(company.start_time)
        self.assertIsNone(company.end_time)

    def test_ingest_companies_duplicate_handling(self):
        """Test that duplicate companies are handled properly (upserted)."""
        # Insert same company twice with different data
        companies_data_v1 = [
            {
                "company": "DuplicateCorp",
                "startDate": "2020-01-01",
                "endDate": "2021-01-01",
                "title": "Junior Developer",
                "description": "Initial role description"
            }
        ]
        
        companies_data_v2 = [
            {
                "company": "DuplicateCorp",
                "startDate": "2020-01-01",  # Same name and start date
                "endDate": "2021-01-01",
                "title": "Senior Developer",  # Updated title
                "description": "Updated role description"  # Updated description
            }
        ]
        
        # First ingestion
        with patch('builtins.open', mock_open(read_data=json.dumps(companies_data_v1))):
            ingest_companies(use_remote=False, data_provider=self.fake_data_provider)
        
        # Second ingestion (should update)
        with patch('builtins.open', mock_open(read_data=json.dumps(companies_data_v2))):
            ingest_companies(use_remote=False, data_provider=self.fake_data_provider)
        
        # Should have updated data, not duplicate
        company = self.fake_data_provider.companies.get_company_by_name("DuplicateCorp")
        self.assertIsNotNone(company)
        self.assertEqual(company.title, "Senior Developer")
        self.assertEqual(company.description, "Updated role description")

    def test_ingest_companies_empty_file(self):
        """Test ingestion with empty company list."""
        with patch('builtins.open', mock_open(read_data="[]")):
            # Should not raise an exception
            ingest_companies(use_remote=False, data_provider=self.fake_data_provider)

    def test_ingest_companies_invalid_json(self):
        """Test handling of invalid JSON file."""
        with patch('builtins.open', mock_open(read_data="invalid json")):
            with self.assertRaises(json.JSONDecodeError):
                ingest_companies(use_remote=False, data_provider=self.fake_data_provider)

    def test_ingest_companies_file_not_found(self):
        """Test handling when companies.json file is not found."""
        with patch('builtins.open', side_effect=FileNotFoundError("File not found")):
            with self.assertRaises(FileNotFoundError):
                ingest_companies(use_remote=False, data_provider=self.fake_data_provider)

    def test_ingest_companies_missing_required_fields(self):
        """Test handling of companies with missing required fields."""
        companies_data = [
            {
                "company": "ValidCorp",
                "startDate": "2020-01-01",
                "endDate": "2021-01-01",
                "title": "Developer",
                "description": "Valid company"
            },
            {
                # Missing company name
                "startDate": "2020-01-01",
                "endDate": "2021-01-01",
                "title": "Developer",
                "description": "Invalid company"
            }
        ]
        
        json_data = json.dumps(companies_data)
        
        with patch('builtins.open', mock_open(read_data=json_data)):
            # Should raise KeyError for missing required field
            with self.assertRaises(KeyError):
                ingest_companies(use_remote=False, data_provider=self.fake_data_provider)

    def test_ingest_companies_invalid_date_format(self):
        """Test handling of invalid date formats."""
        companies_data = [
            {
                "company": "BadDateCorp",
                "startDate": "invalid-date",  # Invalid format
                "endDate": "2021-01-01",
                "title": "Developer",
                "description": "Company with bad start date"
            }
        ]
        
        json_data = json.dumps(companies_data)
        
        with patch('builtins.open', mock_open(read_data=json_data)):
            # Should raise ValueError for invalid date format
            with self.assertRaises(ValueError):
                ingest_companies(use_remote=False, data_provider=self.fake_data_provider)

    def test_ingest_companies_upsert_exception(self):
        """Test handling when upsert operation fails."""
        companies_data = [
            {
                "company": "FailCorp",
                "startDate": "2020-01-01",
                "endDate": "2021-01-01",
                "title": "Developer",
                "description": "This will fail to upsert"
            }
        ]
        
        json_data = json.dumps(companies_data)
        
        # Mock the upsert to raise an exception
        with patch('builtins.open', mock_open(read_data=json_data)):
            with patch.object(self.fake_data_provider.companies, 'upsert_company', 
                            side_effect=Exception("Database error")):
                # Should not crash, should continue processing
                ingest_companies(use_remote=False, data_provider=self.fake_data_provider)

    def test_ingest_companies_with_default_provider(self):
        """Test ingestion with default Supabase provider."""
        json_data = json.dumps(self.sample_companies_data)
        
        with patch('builtins.open', mock_open(read_data=json_data)):
            with patch('ingest_companies.get_supabase_client') as mock_supabase_client:
                with patch('ingest_companies.SupabaseDataAccessProvider') as mock_provider:
                    mock_client = Mock()
                    mock_supabase_client.return_value = mock_client
                    mock_data_provider = Mock()
                    mock_provider.return_value = mock_data_provider
                    
                    # Mock the companies repository
                    mock_companies_repo = Mock()
                    mock_data_provider.companies = mock_companies_repo
                    mock_companies_repo.upsert_company.return_value = Company(
                        id="test-id", name="TestCorp"
                    )
                    
                    ingest_companies(use_remote=True)  # No data_provider specified
                    
                    # Verify Supabase client was created with remote=True
                    mock_supabase_client.assert_called_once_with(use_remote=True)
                    mock_provider.assert_called_once_with(mock_client)

    def test_ingest_companies_unicode_handling(self):
        """Test ingestion of companies with Unicode characters."""
        companies_data = [
            {
                "company": "企業株式会社",  # Japanese company name
                "startDate": "2020-01-01",
                "endDate": "2021-01-01", 
                "title": "Développeur Senior",  # French title with accents
                "description": "Développement d'applications web avec des caractères spéciaux: émojis 🚀"
            }
        ]
        
        json_data = json.dumps(companies_data, ensure_ascii=False)
        
        with patch('builtins.open', mock_open(read_data=json_data)):
            ingest_companies(use_remote=False, data_provider=self.fake_data_provider)
        
        company = self.fake_data_provider.companies.get_company_by_name("企業株式会社")
        self.assertIsNotNone(company)
        self.assertEqual(company.title, "Développeur Senior")
        self.assertIn("🚀", company.description)

    def test_ingest_companies_large_description(self):
        """Test ingestion with very large description text."""
        large_description = "This is a very long description. " * 1000  # Very long text
        
        companies_data = [
            {
                "company": "LargeDescCorp",
                "startDate": "2020-01-01",
                "endDate": "2021-01-01",
                "title": "Developer",
                "description": large_description
            }
        ]
        
        json_data = json.dumps(companies_data)
        
        with patch('builtins.open', mock_open(read_data=json_data)):
            ingest_companies(use_remote=False, data_provider=self.fake_data_provider)
        
        company = self.fake_data_provider.companies.get_company_by_name("LargeDescCorp")
        self.assertIsNotNone(company)
        self.assertEqual(len(company.description), len(large_description))

    def test_ingest_companies_special_characters(self):
        """Test ingestion with special characters in various fields."""
        companies_data = [
            {
                "company": "Special&Chars@Corp!",
                "startDate": "2020-01-01",
                "endDate": "2021-01-01",
                "title": "C++ Developer / Python Engineer",
                "description": "Worked on projects involving: APIs, databases, web scraping & data analysis (50% time)"
            }
        ]
        
        json_data = json.dumps(companies_data)
        
        with patch('builtins.open', mock_open(read_data=json_data)):
            ingest_companies(use_remote=False, data_provider=self.fake_data_provider)
        
        company = self.fake_data_provider.companies.get_company_by_name("Special&Chars@Corp!")
        self.assertIsNotNone(company)
        self.assertIn("C++", company.title)
        self.assertIn("50%", company.description)

    def test_ingest_companies_boundary_dates(self):
        """Test ingestion with boundary date values."""
        companies_data = [
            {
                "company": "BoundaryCorp",
                "startDate": "1900-01-01",  # Very old date
                "endDate": "2099-12-31",   # Future date
                "title": "Time Traveler",
                "description": "Working across centuries"
            }
        ]
        
        json_data = json.dumps(companies_data)
        
        with patch('builtins.open', mock_open(read_data=json_data)):
            ingest_companies(use_remote=False, data_provider=self.fake_data_provider)
        
        company = self.fake_data_provider.companies.get_company_by_name("BoundaryCorp")
        self.assertIsNotNone(company)
        self.assertEqual(company.start_time, date(1900, 1, 1))
        self.assertEqual(company.end_time, date(2099, 12, 31))


if __name__ == '__main__':
    unittest.main()
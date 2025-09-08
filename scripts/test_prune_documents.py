"""
Unit tests for prune_documents.py module.
Tests document and chunk deletion functionality.
"""

import os
import sys
import unittest
from unittest.mock import Mock, patch, MagicMock
from io import StringIO

# Add scripts directory to path for imports
sys.path.insert(0, os.path.dirname(__file__))

import prune_documents
from prune_documents import confirm, delete_all_rows, is_table_empty, main


class TestPruneDocuments(unittest.TestCase):
    """Test the prune_documents functionality."""

    def setUp(self):
        """Set up test fixtures."""
        # Create a mock Supabase client
        self.mock_supabase = MagicMock()
        self.mock_table = MagicMock()
        self.mock_supabase.table.return_value = self.mock_table
        
        # Mock the delete operation chain
        self.mock_delete = MagicMock()
        self.mock_gt = MagicMock()
        self.mock_execute = MagicMock()
        
        self.mock_table.delete.return_value = self.mock_delete
        self.mock_delete.gt.return_value = self.mock_gt
        self.mock_gt.execute.return_value = None

    def test_confirm_with_yes_flag(self):
        """Test confirm function when --yes flag is set."""
        with patch.object(prune_documents, 'skip_confirm', True):
            result = confirm()
            self.assertTrue(result)

    def test_confirm_with_user_yes(self):
        """Test confirm function when user inputs 'y'."""
        with patch.object(prune_documents, 'skip_confirm', False):
            with patch('builtins.input', return_value='y'):
                result = confirm()
                self.assertTrue(result)

    def test_confirm_with_user_yes_uppercase(self):
        """Test confirm function when user inputs 'Y'."""
        with patch.object(prune_documents, 'skip_confirm', False):
            with patch('builtins.input', return_value='Y'):
                result = confirm()
                self.assertTrue(result)

    def test_confirm_with_user_no(self):
        """Test confirm function when user inputs 'n'."""
        with patch.object(prune_documents, 'skip_confirm', False):
            with patch('builtins.input', return_value='n'):
                result = confirm()
                self.assertFalse(result)

    def test_confirm_with_user_empty(self):
        """Test confirm function when user inputs empty string (default no)."""
        with patch.object(prune_documents, 'skip_confirm', False):
            with patch('builtins.input', return_value=''):
                result = confirm()
                self.assertFalse(result)

    def test_confirm_with_user_invalid(self):
        """Test confirm function when user inputs invalid response."""
        with patch.object(prune_documents, 'skip_confirm', False):
            with patch('builtins.input', return_value='maybe'):
                result = confirm()
                self.assertFalse(result)

    def test_confirm_with_whitespace(self):
        """Test confirm function handles whitespace properly."""
        with patch.object(prune_documents, 'skip_confirm', False):
            with patch('builtins.input', return_value='  y  '):
                result = confirm()
                self.assertTrue(result)

    def test_delete_all_rows_success(self):
        """Test successful deletion of all rows from a table."""
        with patch.object(prune_documents, 'supabase', self.mock_supabase):
            delete_all_rows("chunks")
            
            # Verify the correct sequence of calls
            self.mock_supabase.table.assert_called_with("chunks")
            self.mock_table.delete.assert_called_once()
            self.mock_delete.gt.assert_called_with("id", prune_documents.MOCK_UUID)
            self.mock_gt.execute.assert_called_once()

    def test_delete_all_rows_exception(self):
        """Test handling of exceptions during deletion."""
        # Make execute raise an exception
        self.mock_gt.execute.side_effect = Exception("Database error")
        
        with patch.object(prune_documents, 'supabase', self.mock_supabase):
            with patch('sys.exit') as mock_exit:
                delete_all_rows("chunks")
                
                # Should call sys.exit(1) on error
                mock_exit.assert_called_with(1)

    def test_delete_all_rows_different_tables(self):
        """Test deletion works with different table names."""
        table_names = ["chunks", "documents", "companies", "other_table"]
        
        for table_name in table_names:
            with patch.object(prune_documents, 'supabase', self.mock_supabase):
                delete_all_rows(table_name)
                self.mock_supabase.table.assert_called_with(table_name)

    def test_is_table_empty_true(self):
        """Test is_table_empty when table is empty."""
        # Mock empty response
        mock_response = MagicMock()
        mock_response.data = []
        
        mock_select = MagicMock()
        mock_limit = MagicMock()
        mock_execute = MagicMock()
        
        self.mock_table.select.return_value = mock_select
        mock_select.limit.return_value = mock_limit
        mock_limit.execute.return_value = mock_response
        
        with patch.object(prune_documents, 'supabase', self.mock_supabase):
            result = is_table_empty("chunks")
            
            self.assertTrue(result)
            self.mock_supabase.table.assert_called_with("chunks")
            mock_select.limit.assert_called_with(1)

    def test_is_table_empty_false(self):
        """Test is_table_empty when table has data."""
        # Mock non-empty response
        mock_response = MagicMock()
        mock_response.data = [{"id": "some-id"}]
        
        mock_select = MagicMock()
        mock_limit = MagicMock()
        mock_execute = MagicMock()
        
        self.mock_table.select.return_value = mock_select
        mock_select.limit.return_value = mock_limit
        mock_limit.execute.return_value = mock_response
        
        with patch.object(prune_documents, 'supabase', self.mock_supabase):
            result = is_table_empty("chunks")
            
            self.assertFalse(result)

    def test_is_table_empty_no_data_attribute(self):
        """Test is_table_empty when response doesn't have data attribute."""
        # Mock response without data attribute
        mock_response = MagicMock()
        del mock_response.data  # Remove data attribute
        
        mock_select = MagicMock()
        mock_limit = MagicMock()
        
        self.mock_table.select.return_value = mock_select
        mock_select.limit.return_value = mock_limit
        mock_limit.execute.return_value = mock_response
        
        with patch.object(prune_documents, 'supabase', self.mock_supabase):
            result = is_table_empty("chunks")
            
            self.assertFalse(result)  # Should return False if can't determine

    def test_is_table_empty_exception(self):
        """Test is_table_empty when an exception occurs."""
        # Make execute raise an exception
        mock_select = MagicMock()
        mock_limit = MagicMock()
        
        self.mock_table.select.return_value = mock_select
        mock_select.limit.return_value = mock_limit
        mock_limit.execute.side_effect = Exception("Query error")
        
        with patch.object(prune_documents, 'supabase', self.mock_supabase):
            result = is_table_empty("chunks")
            
            self.assertFalse(result)  # Should return False on exception

    def test_main_user_confirms_success(self):
        """Test main function when user confirms and deletion succeeds."""
        with patch.object(prune_documents, 'supabase', self.mock_supabase):
            with patch('prune_documents.confirm', return_value=True):
                with patch('prune_documents.delete_all_rows') as mock_delete:
                    with patch('prune_documents.is_table_empty', return_value=True):
                        with patch('builtins.print'):  # Suppress print output
                            main()
                    
                    # Should delete both tables
                    self.assertEqual(mock_delete.call_count, 2)
                    mock_delete.assert_any_call("chunks")
                    mock_delete.assert_any_call("documents")

    def test_main_user_aborts(self):
        """Test main function when user aborts operation."""
        with patch('prune_documents.confirm', return_value=False):
            with patch('sys.exit') as mock_exit:
                main()
                
                # Should exit with code 0
                mock_exit.assert_called_with(0)

    def test_main_tables_not_empty_after_deletion(self):
        """Test main function when tables are not empty after deletion."""
        with patch.object(prune_documents, 'supabase', self.mock_supabase):
            with patch('prune_documents.confirm', return_value=True):
                with patch('prune_documents.delete_all_rows'):
                    with patch('prune_documents.is_table_empty') as mock_empty:
                        # First call (chunks) returns True, second (documents) returns False
                        mock_empty.side_effect = [True, False]
                        
                        with patch('builtins.print'):  # Suppress print output
                            main()

    def test_main_all_tables_empty_after_deletion(self):
        """Test main function when all tables are empty after deletion."""
        with patch.object(prune_documents, 'supabase', self.mock_supabase):
            with patch('prune_documents.confirm', return_value=True):
                with patch('prune_documents.delete_all_rows'):
                    with patch('prune_documents.is_table_empty', return_value=True):
                        with patch('builtins.print'):  # Suppress print output
                            main()

    @patch('sys.argv')
    def test_command_line_parsing_remote_flag(self, mock_argv):
        """Test command line parsing with --remote flag."""
        mock_argv.__contains__ = lambda self, item: item == "--remote"
        
        # Reload the module to test command line parsing
        with patch('prune_documents.get_supabase_client') as mock_get_client:
            # Import should trigger the command line parsing
            import importlib
            importlib.reload(prune_documents)
            
            # Verify get_supabase_client was called with use_remote=True
            mock_get_client.assert_called_with(use_remote=True)

    @patch('sys.argv')
    def test_command_line_parsing_yes_flag(self, mock_argv):
        """Test command line parsing with --yes flag."""
        mock_argv.__contains__ = lambda self, item: item == "--yes"
        
        # Import should set skip_confirm to True
        import importlib
        importlib.reload(prune_documents)
        
        self.assertTrue(prune_documents.skip_confirm)

    def test_mock_uuid_constant(self):
        """Test that MOCK_UUID constant is properly defined."""
        self.assertEqual(prune_documents.MOCK_UUID, "00000000-0000-0000-0000-000000000000")
        self.assertIsInstance(prune_documents.MOCK_UUID, str)
        self.assertEqual(len(prune_documents.MOCK_UUID), 36)  # UUID length with dashes

    def test_delete_order(self):
        """Test that chunks are deleted before documents (to avoid FK issues)."""
        call_order = []
        
        def track_delete(table_name):
            call_order.append(table_name)
        
        with patch.object(prune_documents, 'supabase', self.mock_supabase):
            with patch('prune_documents.confirm', return_value=True):
                with patch('prune_documents.delete_all_rows', side_effect=track_delete):
                    with patch('prune_documents.is_table_empty', return_value=True):
                        with patch('builtins.print'):  # Suppress print output
                            main()
        
        # Chunks should be deleted before documents
        self.assertEqual(call_order, ["chunks", "documents"])

    def test_integration_output_messages(self):
        """Test that appropriate messages are printed during execution."""
        output = StringIO()
        
        with patch.object(prune_documents, 'supabase', self.mock_supabase):
            with patch('prune_documents.confirm', return_value=True):
                with patch('prune_documents.delete_all_rows'):
                    with patch('prune_documents.is_table_empty', return_value=True):
                        with patch('sys.stdout', output):
                            main()
        
        output_text = output.getvalue()
        self.assertIn("DELETE ALL rows", output_text)
        self.assertIn("SUCCESS", output_text)


if __name__ == '__main__':
    unittest.main()
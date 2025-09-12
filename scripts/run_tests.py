#!/usr/bin/env python3
"""
Test runner for all unit tests in the scripts directory.
Runs all test files and provides a summary of results.
"""

import os
import sys
import unittest
import importlib.util
from typing import List, Tuple

# Add scripts directory to path for imports
sys.path.insert(0, os.path.dirname(__file__))


def discover_test_files() -> List[str]:
    """Discover all test files in the current directory."""
    test_files = []
    current_dir = os.path.abspath(os.path.dirname(__file__))

    for filename in os.listdir(current_dir):
        if filename.startswith("test_") and filename.endswith(".py"):
            test_files.append(filename)

    return sorted(test_files)


def run_test_file(test_file: str) -> Tuple[bool, int, int, List[str]]:
    """
    Run a single test file and return results.

    Returns:
        Tuple of (success, tests_run, failures, error_messages)
    """
    print(f"\n{'=' * 50}")
    print(f"Running {test_file}")
    print("=" * 50)

    try:
        # Load the test module
        spec = importlib.util.spec_from_file_location(
            test_file[:-3],  # Remove .py extension
            os.path.join(os.path.abspath(os.path.dirname(__file__)), test_file),
        )
        test_module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(test_module)

        # Create a test suite
        loader = unittest.TestLoader()
        suite = loader.loadTestsFromModule(test_module)

        # Run the tests
        runner = unittest.TextTestRunner(verbosity=2, buffer=True)
        result = runner.run(suite)

        errors = []
        if result.failures:
            errors.extend([f"FAIL: {test[0]}: {test[1]}" for test in result.failures])
        if result.errors:
            errors.extend([f"ERROR: {test[0]}: {test[1]}" for test in result.errors])

        success = len(result.failures) == 0 and len(result.errors) == 0
        return (
            success,
            result.testsRun,
            len(result.failures) + len(result.errors),
            errors,
        )

    except Exception as e:
        print(f"Error loading or running {test_file}: {e}")
        return False, 0, 1, [f"Module load error: {e}"]


def main():
    """Main test runner function."""
    print("Python Unit Test Runner for Scripts Directory")
    print("=" * 60)

    test_files = discover_test_files()

    if not test_files:
        print("No test files found (files starting with 'test_' and ending with '.py')")
        return

    print(f"Found {len(test_files)} test files:")
    for test_file in test_files:
        print(f"  - {test_file}")

    # Run all tests
    total_tests = 0
    total_failures = 0
    failed_files = []
    all_errors = []

    for test_file in test_files:
        success, tests_run, failures, errors = run_test_file(test_file)
        total_tests += tests_run
        total_failures += failures

        if not success:
            failed_files.append(test_file)
            all_errors.extend(errors)

    # Print summary
    print(f"\n{'=' * 60}")
    print("TEST SUMMARY")
    print("=" * 60)
    print(f"Total test files run: {len(test_files)}")
    print(f"Total tests run: {total_tests}")
    print(f"Total failures/errors: {total_failures}")

    if failed_files:
        print(f"\nFailed test files ({len(failed_files)}):")
        for failed_file in failed_files:
            print(f"  ❌ {failed_file}")

        print(f"\nPassed test files ({len(test_files) - len(failed_files)}):")
        for test_file in test_files:
            if test_file not in failed_files:
                print(f"  ✅ {test_file}")

        if all_errors:
            print(f"\nFirst few errors:")
            for error in all_errors[:5]:  # Show first 5 errors
                print(f"  {error}")
            if len(all_errors) > 5:
                print(f"  ... and {len(all_errors) - 5} more errors")
    else:
        print(f"\nAll test files passed! ✅")
        for test_file in test_files:
            print(f"  ✅ {test_file}")

    # Exit with appropriate code
    exit_code = 1 if failed_files else 0
    print(f"\nExiting with code {exit_code}")
    sys.exit(exit_code)


if __name__ == "__main__":
    main()

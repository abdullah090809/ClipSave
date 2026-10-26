import pytest
import os

# Configure environment for tests
os.environ["ENABLE_MOCK_EXTRACTOR"] = "true"
os.environ["RATE_LIMIT_PER_MINUTE"] = "10"
os.environ["DEBUG"] = "true"

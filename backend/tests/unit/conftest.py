# Override parent conftest's autouse DB fixture — these are pure unit tests.
import pytest

@pytest.fixture(autouse=True, scope="session")
def _test_schema():
    """No-op: unit tests don't need a database."""
    yield

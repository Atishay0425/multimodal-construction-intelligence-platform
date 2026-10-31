import os
import tempfile

# Must be set before the app (and its cached settings) is imported.
os.environ["AI_MODE"] = "demo"
os.environ["DATA_DIR"] = tempfile.mkdtemp(prefix="mcip-test-")
os.environ["ANTHROPIC_API_KEY"] = ""

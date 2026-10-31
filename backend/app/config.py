from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=BASE_DIR / ".env", extra="ignore")

    anthropic_api_key: str = ""
    claude_model: str = "claude-opus-5-5"
    claude_effort: str = "medium"
    gemini_api_key: str = ""
    gemini_model: str = "gemini-3.5-flash"
    # Tried in order when the model before is overloaded (503) or times out; empty disables fallback.
    gemini_fallback_models: str = "gemini-3.5-flash-lite"
    gemini_timeout_s: int = 90
    ai_provider: str = "auto"  # auto | anthropic | gemini
    ai_mode: str = "auto"  # auto | live | demo
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    max_images: int = 5
    max_image_mb: int = 10
    data_dir: Path = BASE_DIR / "data"
    # Optional shared password for public deployments; empty = no login.
    app_password: str = ""
    # Max analysis requests per client IP per hour (protects your API credit).
    rate_limit_per_hour: int = 60
    # Only enable behind a reverse proxy you control; otherwise X-Forwarded-For is spoofable.
    trust_proxy: bool = False
    frontend_dist: Path = BASE_DIR.parent / "frontend" / "dist"

    @property
    def provider(self) -> str:
        """Which model backend to call. auto prefers Claude, then Gemini, whichever has a key."""
        if self.ai_provider in ("anthropic", "gemini"):
            return self.ai_provider
        if self.anthropic_api_key:
            return "anthropic"
        if self.gemini_api_key:
            return "gemini"
        return "anthropic"

    @property
    def gemini_models(self) -> list[str]:
        """Main model first, then fallbacks, without duplicates."""
        extra = [m.strip() for m in self.gemini_fallback_models.split(",") if m.strip()]
        return list(dict.fromkeys([self.gemini_model, *extra]))

    @property
    def model_name(self) -> str:
        return self.gemini_model if self.provider == "gemini" else self.claude_model

    @property
    def live(self) -> bool:
        if self.ai_mode == "demo":
            return False
        if self.ai_mode == "live":
            return True
        return bool(self.gemini_api_key if self.provider == "gemini" else self.anthropic_api_key)

    @property
    def cors_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()

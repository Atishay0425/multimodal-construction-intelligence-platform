"""Optional password gate and per-IP rate limiting for public deployments."""
import hashlib
import hmac
import threading
import time
from collections import defaultdict, deque

from fastapi import Request
from fastapi.responses import JSONResponse

from .config import get_settings

COOKIE = "mcip_auth"
# Paths reachable without logging in.
PUBLIC = {"/api/health", "/api/auth"}
# Paths that call the model and therefore cost money.
METERED = ("/api/safety/", "/api/cracks/", "/api/valuation/", "/api/planning/",
           "/api/assistant/", "/api/knowledge/")


def auth_token(password: str) -> str:
    return hmac.new(password.encode(), b"mcip-session", hashlib.sha256).hexdigest()


def is_authenticated(request: Request) -> bool:
    pw = get_settings().app_password
    if not pw:
        return True
    return hmac.compare_digest(request.cookies.get(COOKIE, "").encode(), auth_token(pw).encode())


def client_ip(request: Request) -> str:
    if get_settings().trust_proxy:
        fwd = request.headers.get("x-forwarded-for")
        if fwd:
            return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


class RateLimiter:
    def __init__(self, window: float = 3600.0):
        self.window = window
        self.hits: dict[str, deque] = defaultdict(deque)
        self.lock = threading.Lock()

    def check(self, key: str, limit: int) -> int:
        """Record a hit; return 0 if allowed, else seconds until a slot frees up."""
        now = time.monotonic()
        with self.lock:
            q = self.hits[key]
            while q and now - q[0] >= self.window:
                q.popleft()
            if len(q) >= limit:
                return int(self.window - (now - q[0])) + 1
            q.append(now)
            return 0

    def reset(self):
        with self.lock:
            self.hits.clear()


limiter = RateLimiter()


async def security_middleware(request: Request, call_next):
    path = request.url.path
    protected = (path.startswith("/api/") and path not in PUBLIC) or path.startswith("/uploads/")
    if protected and not is_authenticated(request):
        return JSONResponse(status_code=401, content={"detail": "Password required."})
    if request.method == "POST" and path.startswith(METERED):
        limit = get_settings().rate_limit_per_hour
        if limit > 0:
            wait = limiter.check(client_ip(request), limit)
            if wait:
                return JSONResponse(
                    status_code=429, headers={"Retry-After": str(wait)},
                    content={"detail": f"Hourly limit of {limit} analyses reached. Try again in {wait // 60 + 1} min."})
    return await call_next(request)

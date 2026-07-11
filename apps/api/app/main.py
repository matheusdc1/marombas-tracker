import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .metrics import router as metrics_router
from .photos import router as photos_router
from .routes import router

app = FastAPI(title="Marombas Tracker API")

# em producao (Railway), setar ALLOWED_ORIGINS=https://<front>.up.railway.app
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("ALLOWED_ORIGINS", "http://localhost:5173").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)
app.include_router(metrics_router)
app.include_router(photos_router)

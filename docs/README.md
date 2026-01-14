# Dialectic

Strategic intelligence workbench for processing ideas through dialectical reasoning.

## Quick Start

### Prerequisites
- Node.js 20+
- Python 3.10+

### Setup

```bash
# Install frontend dependencies
npm install

# Install backend dependencies
cd backend && pip install -r requirements.txt
```

### Development

```bash
# Terminal 1: Start backend
cd backend && python server_lite.py

# Terminal 2: Start frontend
npm run dev
```

Open http://localhost:5173

## Architecture

- `packages/web/` - React frontend (Vite + TypeScript + Tailwind)
- `packages/shared/` - Shared types and utilities
- `backend/` - Python FastAPI backend with multi-pass reasoning engine

## License

MIT

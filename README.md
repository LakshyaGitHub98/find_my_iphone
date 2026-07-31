# Find My iPhone

A self-hosted, open-source alternative to Apple's "Find My" that lets you locate and manage your Apple devices (iPhone, iPad, Mac) from any browser — powered by your own iCloud account. Includes a FastAPI backend, a Next.js web dashboard, and a full-featured CLI.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Backend](https://img.shields.io/badge/backend-FastAPI-green)
![Frontend](https://img.shields.io/badge/frontend-Next.js%2015-black)
![Platform](https://img.shields.io/badge/platform-Web%20%2B%20CLI-lightgrey)

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Run with Docker (recommended)](#run-with-docker-recommended)
  - [Run the Backend (local)](#run-the-backend-local)
  - [Run the Frontend (local)](#run-the-frontend-local)
  - [CLI Usage](#cli-usage)
- [API Reference](#api-reference)
- [Project Structure](#project-structure)
- [Security Considerations](#security-considerations)
- [Roadmap & Future Scope](#roadmap--future-scope)
- [Contributing](#contributing)
- [License](#license)
- [Acknowledgments](#acknowledgments)

---

## Features

- **iCloud Sign-In** — Authenticate with your Apple ID, including full support for Two-Factor Authentication (2FA) via trusted devices or SMS.
- **Device Dashboard** — See every device on your account with online/offline status, battery level, and model info at a glance.
- **Real-Time Location** — View any device's last known location on an interactive map (OpenStreetMap + Leaflet) with coordinates, accuracy, and timestamp.
- **Play Sound** — Ring any device remotely to help find it, with a custom alert message.
- **Lost Mode** — Lock a lost device remotely, display a custom message and contact number on the lock screen, and optionally set a new passcode.
- **Session Persistence** — Stay signed in across restarts; the authenticated iCloud session is cached locally.
- **CLI Tool** — The same features available from the terminal: `login`, `list`, `locate`, `sound`, `lost`, `status`.
- **Dockerized** — One-command deployment of the entire stack via Docker Compose.

## Tech Stack

| Layer     | Technology                                                                 |
|-----------|----------------------------------------------------------------------------|
| Backend   | Python 3.10, FastAPI, Uvicorn, PyiCloud, Pydantic                           |
| Frontend  | Next.js 15, React 19, TypeScript, Tailwind CSS 4, Radix UI, Leaflet        |
| CLI       | Python, Click, Rich, PyiCloud                                              |
| Infra     | Docker, Docker Compose, OpenStreetMap (tiles)                              |

## Architecture

```
┌───────────────────────┐         ┌───────────────────────┐        ┌──────────────────────┐
│   Web Dashboard       │  REST   │      FastAPI          │ iCloud │    Apple iCloud       │
│   (Next.js)           │ ──────► │     Backend           │ API    │    Services (Find My) │
│   Port 3000           │         │     Port 8000         │ ─────► │                       │
└───────────────────────┘         └───────────────────────┘        └──────────────────────┘
        ▲                                  ▲
        │                                  │
   ┌────┴─────┐                      ┌─────┴─────┐
   │   CLI    │──────────────────────│   Local   │
   │  (rich)  │   same iCloud session│  session  │
   └──────────┘                      └───────────┘
```

The backend wraps the `pyicloud` library, handles the interactive 2FA flow, and exposes a clean REST API consumed by both the Next.js frontend and (conceptually) any other client. The frontend proxies `/api/*` requests to the backend via Next.js rewrites, so only the frontend port needs to be exposed.

## Getting Started

### Prerequisites

- **Docker** + **Docker Compose** (for the containerized setup), **or**
- **Python 3.10+** and **Node.js 18+** (for local development)
- An **Apple ID** with Find My enabled and at least one Apple device

> **Note:** Apple may rate-limit or require 2FA on new sign-ins. Keep your Apple ID credentials and 2FA device ready during first-time authentication.

### Run with Docker (recommended)

```bash
docker compose up --build
```

- Web dashboard: http://localhost:3000
- Backend API: http://localhost:8000/api/health
- A named volume (`findmy-data`) persists your iCloud session across container restarts.

### Run the Backend (local)

```bash
cd backend
python -m venv venv
# Windows: venv\Scripts\activate   |   macOS/Linux: source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Run the Frontend (local)

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000. In development, the Next.js dev server proxies `/api/*` to `http://127.0.0.1:8000` by default (override with the `BACKEND_URL` env var).

### CLI Usage

```bash
cd cli
pip install -r requirements.txt

python findmy.py login                 # authenticate with your Apple ID
python findmy.py list                  # list all devices
python findmy.py locate "iPhone"       # get current location (name or index)
python findmy.py sound "iPhone" -m "I'm over here!"   # play a sound
python findmy.py lost "iPhone" -n "+15551234567"      # enable Lost Mode
python findmy.py status "iPhone"       # detailed device status
```

The CLI and the backend share the same session file (`~/.findmy-session.json`), so a CLI login also authenticates the web app and vice versa.

## API Reference

Base URL: `http://localhost:8000`

| Method | Endpoint                       | Description                                 |
|--------|--------------------------------|---------------------------------------------|
| GET    | `/api/health`                  | Health check                                |
| POST   | `/api/auth/login`              | Log in with Apple ID + password             |
| POST   | `/api/auth/2fa/send`           | Send a 2FA code to a trusted device/phone   |
| POST   | `/api/auth/2fa/verify`         | Verify the 2FA code                         |
| POST   | `/api/auth/2fa/verify-direct`  | Verify 2FA code when no method was selected |
| GET    | `/api/auth/session`            | Check if a session is authenticated         |
| POST   | `/api/auth/logout`             | Clear the active session                    |
| GET    | `/api/devices`                 | List all devices                            |
| GET    | `/api/devices/{id}`            | Get a single device's details               |
| GET    | `/api/devices/{id}/location`   | Get a device's last known location          |
| POST   | `/api/devices/{id}/sound`      | Play a sound on a device                    |
| POST   | `/api/devices/{id}/lost`       | Enable Lost Mode on a device                |

Interactive API docs are available at http://localhost:8000/docs (Swagger UI).

## Project Structure

```
find_my_iphone/
├── backend/                     # FastAPI service
│   ├── api/
│   │   ├── auth.py              #   iCloud auth + 2FA endpoints
│   │   └── devices.py           #   device/location/sound/lost endpoints
│   ├── icloud_client.py         # PyiCloud wrapper, session & 2FA logic
│   ├── client.py                # Global client singleton
│   ├── main.py                  # App entry point & CORS config
│   ├── Dockerfile
│   └── requirements.txt
├── cli/                         # Terminal interface
│   ├── findmy.py                # Click commands: login/list/locate/sound/lost/status
│   ├── icloud_client.py
│   └── requirements.txt
├── frontend/                    # Next.js dashboard
│   ├── app/
│   │   ├── dashboard/           #   device list
│   │   ├── device/[id]/         #   device detail + map
│   │   ├── login/               #   sign-in + 2FA flow
│   │   └── page.tsx             #   session redirect
│   ├── components/
│   │   ├── DeviceMap.tsx        #   Leaflet map
│   │   ├── LostModeDialog.tsx
│   │   └── ui/                  #   shadcn/ui components
│   ├── lib/api.ts               #   typed API client
│   ├── Dockerfile
│   └── package.json
├── docker-compose.yml           # Backend + frontend orchestration
└── .gitignore
```

## Security Considerations

- **Credentials are cached locally.** The backend stores your Apple ID password base64-encoded in `~/.findmy-session.json` and iCloud cookies under `~/.findmy-cookies`. This is a convenience trade-off and is **not** a secure secret store. Use this tool on machines you control, protect the session file, and consider encrypting it at rest (see Roadmap).
- **No TLS by default.** In the local/Docker setup, credentials travel in plaintext. Terminate TLS behind a reverse proxy (e.g., Caddy or Nginx) before exposing the service to a network.
- **Keep the API private.** The backend has no multi-user isolation; it is designed to be a single-user, self-hosted service. Do not expose it publicly without an auth layer or VPN.
- **Apple may flag unusual logins.** Frequent full sign-ins may trigger Apple security prompts. The session cache helps minimize this.

## Roadmap & Future Scope

The current release covers the core Find My workflow. Planned improvements and long-term directions include:

**Short term**
- [ ] Store credentials securely using a system keychain (e.g., `keyring`) or an encrypted vault instead of base64 files
- [ ] Refresh the iCloud session automatically before token/session expiry to avoid re-prompting for 2FA
- [ ] Add a "Get Directions" button (Google Maps / Apple Maps deep links) from the device map
- [ ] Add automated unit tests for the auth flow and the API layer
- [ ] Dark mode and mobile-responsive polish for the dashboard

**Mid term**
- [ ] Device history and location timeline (breadcrumbs) with geofence alerts
- [ ] Push/email notifications when a device comes online, goes offline, or leaves a geofence
- [ ] Manage multiple Apple IDs with per-account device grouping
- [ ] Trigger Lost Mode / sound with a pre-configured one-tap action for emergencies
- [ ] GitHub Actions CI/CD pipeline: lint, type-check, test, build, and publish Docker images

**Long term**
- [ ] Real-time location streaming using WebSockets instead of polling
- [ ] Native mobile apps (React Native / Flutter) that reuse the existing API
- [ ] Community features: shared "trusted circle" device visibility across users
- [ ] Internationalization (i18n) for multiple locales
- [ ] Optional integration with Home Assistant / smart-home automation (e.g., geo-triggered scenes)
- [ ] Stateless, horizontally scalable deployments backed by a database + Redis

Contributions toward any of these items are welcome — see [Contributing](#contributing).

## Contributing

Contributions are welcome and appreciated.

1. Fork the repository and create a feature branch (`git checkout -b feature/amazing-feature`).
2. Make your changes, keeping code style consistent with the existing codebase.
3. Test locally (backend: `uvicorn`, frontend: `npm run build`, CLI: manual smoke test).
4. Open a pull request describing your changes and how they were tested.

## License

Distributed under the MIT License. See `LICENSE` for more information.

## Acknowledgments

- [PyiCloud](https://github.com/picklepete/pyicloud) for enabling iCloud API access
- [Leaflet](https://leafletjs.com/) and [OpenStreetMap](https://www.openstreetmap.org/) for mapping
- [shadcn/ui](https://ui.shadcn.com/) components and the Next.js community
- Apple, iPhone, and iCloud are trademarks of Apple Inc. This project is not affiliated with or endorsed by Apple.

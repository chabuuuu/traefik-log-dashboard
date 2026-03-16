# Traefik Log Dashboard

Real-time analytics and monitoring dashboard for Traefik reverse proxy logs built with Next.js 15, React 19, and TypeScript.

## Features

- **Real-time Monitoring**: Live updates of Traefik access logs with automatic refresh
- **Advanced Analytics**: 
  - Request metrics (total requests, requests per second)
  - Response time analysis (average, P95, P99)
  - Status code distribution with error rate tracking
  - Top routes and endpoints by traffic volume
- **Router & Service Metrics**: Track performance at router and backend service levels
- **Geographic Distribution**: Visualize request origins by country
- **User Agent Analysis**: Browser and client type breakdown
- **Timeline Visualization**: Request volume over time with interactive charts
- **Demo Mode**: Test the dashboard with simulated data

## Tech Stack

- **Framework**: Next.js 15 with App Router
- **UI**: React 19, Tailwind CSS 4
- **Charts**: Chart.js, D3.js
- **Icons**: Lucide React
- **Language**: TypeScript

## Prerequisites

- Node.js 18.x or higher
- npm 9.x or higher
- Traefik Log Dashboard Agent running (for live data)

## Installation

```bash
npm install
```

## Configuration

Create a `.env.local` file in the dashboard directory:

```env
# Agent configuration (env-managed)
AGENT_1_NAME=Local Agent
AGENT_1_URL=http://localhost:5000
AGENT_1_TOKEN=your_secret_token_here

# Optional: lock agent config to env-only mode
DASHBOARD_AGENTS_ENV_ONLY=true
```

## Development

Start the development server:

```bash
npm run dev
```

The dashboard will be available at `http://localhost:3000`

## Production Build

Build the application:

```bash
npm run build
```

Start the production server:

```bash
npm start
```

## Docker Deployment

Build the Docker image:

```bash
docker build -t traefik-log-dashboard .
```

Run the container:

```bash
docker run -p 3000:3000 \
  -e AGENT_1_URL=http://agent:5000 \
  -e AGENT_1_TOKEN=your_token \
  traefik-log-dashboard
```

## Usage

### Live Dashboard

Navigate to `/dashboard` to view real-time analytics from your Traefik agent.

### Demo Mode

Navigate to `/dashboard/demo` to view the dashboard with simulated data (no agent required).

## Project Structure

```
dashboard/
├── app/                      # Next.js app router
│   ├── api/                 # API routes (proxy to agent)
│   ├── dashboard/           # Dashboard pages
│   └── page.tsx             # Home page
├── components/
│   ├── dashboard/           # Dashboard components
│   │   ├── cards/          # Metric cards
│   │   ├── Dashboard.tsx   # Main dashboard
│   │   └── DashboardGrid.tsx
│   ├── charts/              # Chart components
│   └── ui/                  # UI components
├── lib/                      # Utilities and types
│   ├── types.ts            # TypeScript types
│   ├── traefik-parser.ts   # Log parsing
│   ├── api-client.ts       # API client
│   ├── demo.ts             # Demo data generator
│   ├── location.ts         # Geo location
│   └── utils.ts            # Utility functions
└── public/                  # Static assets
```

## API Endpoints

The dashboard proxies requests to the agent through these endpoints:

- `GET /api/logs/access` - Fetch access logs
- `GET /api/logs/error` - Fetch error logs
- `GET /api/logs/status` - Get agent status
- `GET /api/system/resources` - Get system resources
- `GET /api/system/logs` - Get log file sizes

## Key Metrics

### Request Metrics
- Total requests
- Requests per second
- Change percentage

### Response Time
- Average response time
- P95 percentile
- P99 percentile

### Status Codes
- 2xx (Success)
- 3xx (Redirect)
- 4xx (Client Error)
- 5xx (Server Error)
- Error rate percentage

### Routes & Services
- Top routes by request volume
- Backend service performance
- Router metrics
- Average response times

## Traefik Log Format

The dashboard supports both JSON and CLF (Common Log Format) Traefik logs:

**JSON Format:**
```json
{
  "ClientAddr": "192.168.1.100:54321",
  "RequestMethod": "GET",
  "RequestPath": "/api/users",
  "DownstreamStatus": 200,
  "Duration": 15000000,
  "RouterName": "api-router",
  "ServiceName": "backend-service"
}
```

**CLF Format:**
```
192.168.1.100 - - [03/Oct/2025:10:30:00 +0000] "GET /api/users HTTP/1.1" 200 1234 "-" "Mozilla/5.0..." 1 "api-router" "http://backend:8080" 15ms
```

## Customization

### Refresh Interval

Modify the refresh interval in `app/dashboard/page.tsx`:

```typescript
const interval = setInterval(fetchLogs, 5000); // 5 seconds
```

### Theme

The dashboard supports dark mode through Tailwind CSS. Customize colors in `tailwind.config.js`.

## Troubleshooting

### Connection Error

If you see "Connection Error", ensure:
1. The agent is running at the configured `AGENT_1_URL` (or equivalent configured env agent URL)
2. The agent authentication token matches `AGENT_1_TOKEN` (or the corresponding env token)
3. Network connectivity between dashboard and agent

### No Data

If metrics show zero:
1. Verify Traefik is writing logs
2. Check agent log paths are correct
3. Ensure logs are in a supported format

## License

MIT

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

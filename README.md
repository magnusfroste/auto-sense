# Sense - Intelligent Vehicle Trip Tracking

## Overview
Sense is an intelligent vehicle trip tracking application that automatically detects, records, and manages vehicle trips using Smartcar API integration. The system features a robust, configurable trip detection algorithm with real-time monitoring capabilities.

## Key Features
- 🚗 **Automatic Trip Detection** - Smart algorithm detects trip start/end automatically
- ⚙️ **Configurable Thresholds** - User-customizable sensitivity and timing settings
- 🎯 **Intelligent Filtering** - Automatically filters out false positives and short trips
- 📱 **Real-time Updates** - Live trip monitoring with dynamic polling
- 🛡️ **Safety Mechanisms** - Prevents infinite trips and data corruption
- 📊 **Trip Analytics** - Detailed trip metrics and historical data

## Trip Detection Algorithm
The core trip detection uses a sophisticated state machine with configurable parameters:

### Configurable Settings (per user)
- **Movement Threshold**: Minimum movement to start a trip (default: 100m)
- **Stationary Timeout**: Time without movement to end trip (default: 2 min)
- **Minimum Distance**: Minimum trip length to keep (default: 500m)
- **Maximum Duration**: Safety limit for trip length (default: 12h)
- **Sensitivity Level**: Overall detection sensitivity (low/normal/high)

### Trip States
- **Pending** - Trip just started, awaiting confirmation
- **Active** - Confirmed ongoing trip
- **Completed** - Finished and saved trip

## Documentation
- 📋 **[Trip Algorithm Details](docs/TRIP_ALGORITHM.md)** - Complete algorithm documentation
- 🏗️ **Architecture** - Database schema and API endpoints
- 🔧 **Configuration** - How to adjust trip detection settings
- 🐛 **Troubleshooting** - Common issues and solutions

## Tech Stack
This project is built with:
- **Frontend**: React + TypeScript + Tailwind CSS + shadcn-ui
- **Backend**: Supabase (Database + Edge Functions + Realtime)
- **Vehicle API**: Smartcar Integration
- **Build Tool**: Vite

### Key Files
- `src/hooks/useVehicleTrip.tsx` - Frontend trip management
- `src/hooks/useTrips.tsx` - Trip data management
- `supabase/functions/vehicle-trip-polling/` - Core algorithm
- `docs/TRIP_ALGORITHM.md` - Detailed algorithm documentation

## Getting Started
1. Connect your vehicle via Smartcar integration
2. Configure your trip detection preferences in settings
3. Start driving - trips will be detected automatically!

---

## Development

**Use Lovable**
Simply visit the [Lovable Project](https://lovable.dev/projects/37ba7bea-4e4a-40da-b001-982449075670) and start prompting.

**Use your preferred IDE**
If you want to work locally using your own IDE, you can clone this repo and push changes.

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

## Deployment
Simply open [Lovable](https://lovable.dev/projects/37ba7bea-4e4a-40da-b001-982449075670) and click on Share → Publish.

## Custom Domain
To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.
Read more: [Setting up a custom domain](https://docs.lovable.dev/tips-tricks/custom-domain#step-by-step-guide)

---

For detailed algorithm documentation and troubleshooting, see [docs/TRIP_ALGORITHM.md](docs/TRIP_ALGORITHM.md)

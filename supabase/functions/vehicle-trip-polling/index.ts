const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface VehicleState {
  id: string;
  user_id: string;
  access_token: string;
  smartcar_vehicle_id: string;
  last_odometer?: number;
  last_location?: { latitude: number; longitude: number };
  last_poll_time?: string;
  current_trip_id?: string;
  polling_frequency: number; // seconds
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { 
      headers: corsHeaders,
      status: 405 
    })
  }

  try {
    const { connectionId } = await req.json()
    
    // If connectionId is provided, poll specific vehicle. Otherwise poll all active vehicles.
    if (connectionId) {
      await pollSingleVehicle(connectionId)
    } else {
      await pollAllActiveVehicles()
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Polling completed'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    })

  } catch (error) {
    console.error('Vehicle polling error:', error)
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    })
  }
})

async function pollAllActiveVehicles() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  
  // Fetch all vehicle connections (no is_active column anymore)
  const connectionsResponse = await fetch(`${supabaseUrl}/rest/v1/vehicle_connections?select=*`, {
    headers: {
      'Authorization': `Bearer ${supabaseServiceKey}`,
      'apikey': supabaseServiceKey,
      'Content-Type': 'application/json'
    }
  })

  if (!connectionsResponse.ok) {
    throw new Error('Failed to fetch vehicle connections')
  }

  const connections = await connectionsResponse.json()
  console.log(`Found ${connections.length} vehicle connections to poll`)

  // Poll each vehicle
  for (const connection of connections) {
    try {
      await pollSingleVehicle(connection.id, connection)
    } catch (error) {
      console.error(`Error polling vehicle ${connection.id}:`, error)
    }
  }
}

async function pollSingleVehicle(connectionId: string, connectionData?: any) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  let connection = connectionData
  
  if (!connection) {
    // Fetch connection data
    const connectionResponse = await fetch(`${supabaseUrl}/rest/v1/vehicle_connections?id=eq.${connectionId}&select=*`, {
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'apikey': supabaseServiceKey,
        'Content-Type': 'application/json'
      }
    })

    if (!connectionResponse.ok) {
      throw new Error('Failed to fetch vehicle connection')
    }

    const connections = await connectionResponse.json()
    if (connections.length === 0) {
      throw new Error('Vehicle connection not found')
    }
    connection = connections[0]
  }

  console.log(`Polling vehicle ${connection.smartcar_vehicle_id}`)

  // Get current vehicle data from Smartcar
  const vehicleData = await fetchSmartcarData(connection.smartcar_vehicle_id, connection.access_token)
  
  // Get last known state from database
  const lastState = await getVehicleState(connectionId)
  
  // Analyze trip state and update database
  await analyzeTripState(connection, vehicleData, lastState)
}

async function fetchSmartcarData(vehicleId: string, accessToken: string) {
  const [locationRes, odometerRes] = await Promise.all([
    fetch(`https://api.smartcar.com/v2.0/vehicles/${vehicleId}/location`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    }).catch(e => ({ ok: false, error: e.message })),
    
    fetch(`https://api.smartcar.com/v2.0/vehicles/${vehicleId}/odometer`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    }).catch(e => ({ ok: false, error: e.message }))
  ])

  const data: any = {
    timestamp: new Date().toISOString(),
    vehicleId
  }

  if (locationRes.ok) {
    const location = await locationRes.json()
    data.location = {
      latitude: location.latitude,
      longitude: location.longitude
    }
  }

  if (odometerRes.ok) {
    const odometer = await odometerRes.json()
    data.odometer = {
      distance: odometer.distance
    }
  }

  return data
}

async function getVehicleState(connectionId: string): Promise<VehicleState | null> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  // Try to get existing state from a vehicle_states table (we'll create this)
  const stateResponse = await fetch(`${supabaseUrl}/rest/v1/vehicle_states?connection_id=eq.${connectionId}&select=*`, {
    headers: {
      'Authorization': `Bearer ${supabaseServiceKey}`,
      'apikey': supabaseServiceKey,
      'Content-Type': 'application/json'
    }
  })

  if (stateResponse.ok) {
    const states = await stateResponse.json()
    return states.length > 0 ? states[0] : null
  }

  return null
}

async function analyzeTripState(connection: any, vehicleData: any, lastState: VehicleState | null) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  const currentOdometer = vehicleData.odometer?.distance
  const currentLocation = vehicleData.location
  const currentTime = new Date().toISOString()

  if (!currentOdometer) {
    console.log('No odometer data available, skipping trip analysis')
    return
  }

  // Check if vehicle has moved based on odometer
  const hasMovedSignificantly = lastState && lastState.last_odometer ? 
    (currentOdometer - lastState.last_odometer) > 500 : // 500 meters threshold
    false

  // Check if there's an active trip for this vehicle
  const activeTripsResponse = await fetch(`${supabaseUrl}/rest/v1/sense_trips?vehicle_connection_id=eq.${connection.id}&trip_status=eq.active&select=*`, {
    headers: {
      'Authorization': `Bearer ${supabaseServiceKey}`,
      'apikey': supabaseServiceKey,
      'Content-Type': 'application/json'
    }
  })

  const activeTrips = activeTripsResponse.ok ? await activeTripsResponse.json() : []
  const hasActiveTrip = activeTrips.length > 0

  // Trip logic
  if (hasMovedSignificantly && !hasActiveTrip) {
    // Start new trip
    console.log(`Starting new trip for vehicle ${connection.smartcar_vehicle_id}`)
    await startNewTrip(connection, currentLocation, currentOdometer)
  } else if (hasActiveTrip) {
    const activeTrip = activeTrips[0]
    
    if (hasMovedSignificantly) {
      // Update ongoing trip
      console.log(`Updating ongoing trip ${activeTrip.id}`)
      await updateOngoingTrip(activeTrip, currentLocation, currentOdometer)
    } else {
      // Check if vehicle has been stationary for a while (end trip)
      const timeSinceLastPoll = lastState?.last_poll_time ? 
        new Date().getTime() - new Date(lastState.last_poll_time).getTime() : 0
      
      if (timeSinceLastPoll > 5 * 60 * 1000) { // 5 minutes stationary
        console.log(`Ending trip ${activeTrip.id} - vehicle stationary`)
        await endTrip(activeTrip, currentLocation, currentOdometer)
      }
    }
  }

  // Update vehicle state
  await updateVehicleState(connection.id, {
    last_odometer: currentOdometer,
    last_location: currentLocation,
    last_poll_time: currentTime,
    current_trip_id: hasActiveTrip ? activeTrips[0].id : null,
    polling_frequency: hasActiveTrip ? 30 : 120 // 30s when active, 2min when idle
  })
}

async function startNewTrip(connection: any, location: any, odometer: number) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  const tripData = {
    user_id: connection.user_id,
    vehicle_connection_id: connection.id,
    start_time: new Date().toISOString(),
    start_location: location || {},
    trip_status: 'active',
    trip_type: 'unknown',
    odometer_km: odometer ? Math.round(odometer / 1000) : null,
    is_automatic: true
  }

  await fetch(`${supabaseUrl}/rest/v1/sense_trips`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${supabaseServiceKey}`,
      'apikey': supabaseServiceKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(tripData)
  })
}

async function updateOngoingTrip(trip: any, location: any, odometer: number) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  const startOdometer = trip.odometer_km ? trip.odometer_km * 1000 : 0
  const distanceKm = odometer > startOdometer ? (odometer - startOdometer) / 1000 : 0
  const durationMinutes = Math.floor((new Date().getTime() - new Date(trip.start_time).getTime()) / (1000 * 60))

  const updates = {
    distance_km: Math.round(distanceKm * 100) / 100, // Round to 2 decimals
    duration_minutes: durationMinutes,
    updated_at: new Date().toISOString()
  }

  await fetch(`${supabaseUrl}/rest/v1/sense_trips?id=eq.${trip.id}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${supabaseServiceKey}`,
      'apikey': supabaseServiceKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(updates)
  })
}

async function endTrip(trip: any, location: any, odometer: number) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  const startOdometer = trip.odometer_km ? trip.odometer_km * 1000 : 0
  const distanceKm = odometer > startOdometer ? (odometer - startOdometer) / 1000 : 0
  const durationMinutes = Math.floor((new Date().getTime() - new Date(trip.start_time).getTime()) / (1000 * 60))

  const updates = {
    end_time: new Date().toISOString(),
    end_location: location || {},
    distance_km: Math.round(distanceKm * 100) / 100,
    duration_minutes: durationMinutes,
    trip_status: 'completed',
    updated_at: new Date().toISOString()
  }

  await fetch(`${supabaseUrl}/rest/v1/sense_trips?id=eq.${trip.id}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${supabaseServiceKey}`,
      'apikey': supabaseServiceKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(updates)
  })
}

async function updateVehicleState(connectionId: string, state: any) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  const stateData = {
    connection_id: connectionId,
    ...state,
    updated_at: new Date().toISOString()
  }

  // Upsert vehicle state
  await fetch(`${supabaseUrl}/rest/v1/vehicle_states`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${supabaseServiceKey}`,
      'apikey': supabaseServiceKey,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates'
    },
    body: JSON.stringify(stateData)
  })
}
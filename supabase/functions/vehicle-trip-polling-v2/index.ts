interface VehicleState {
  id: string
  connection_id: string
  last_odometer: number | null
  last_location: { latitude: number; longitude: number } | null
  last_poll_time: string | null
  current_trip_id: string | null
  polling_frequency: number | null
  created_at: string
  updated_at: string
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Global lock to prevent race conditions
const processingLocks = new Map<string, boolean>()

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { connectionId, action = 'poll_all' } = await req.json();

    if (action === 'poll_single' && connectionId) {
      await pollSingleVehicle(connectionId);
    } else {
      await pollAllActiveVehicles();
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Polling completed' }),
      { 
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders 
        } 
      }
    );

  } catch (error) {
    console.error('❌ Error in vehicle polling:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        message: error.message 
      }),
      { 
        status: 500, 
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders 
        } 
      }
    );
  }
});

async function pollAllActiveVehicles() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  console.log('🔄 Polling all active vehicles...')

  // Fetch all active vehicle connections
  const connectionsResponse = await fetch(`${supabaseUrl}/rest/v1/vehicle_connections?select=*`, {
    headers: {
      'Authorization': `Bearer ${supabaseServiceKey}`,
      'apikey': supabaseServiceKey,
      'Content-Type': 'application/json'
    }
  })

  if (!connectionsResponse.ok) {
    console.error('❌ Failed to fetch connections')
    return
  }

  const connections = await connectionsResponse.json()
  console.log(`📡 Found ${connections.length} vehicle connections`)

  // Poll each vehicle with proper error handling
  for (const connection of connections) {
    try {
      console.log(`🚗 Processing vehicle ${connection.smartcar_vehicle_id}`)
      await pollSingleVehicle(connection.id, connection)
    } catch (error) {
      console.error(`❌ Error polling vehicle ${connection.smartcar_vehicle_id}:`, error)
      // Continue with other vehicles even if one fails
    }
  }
}

async function pollSingleVehicle(connectionId: string, connectionData?: any) {
  // Check if this connection is already being processed (race condition prevention)
  if (processingLocks.get(connectionId)) {
    console.log(`⏭️ Skipping ${connectionId} - already being processed`)
    return
  }

  // Set processing lock
  processingLocks.set(connectionId, true)

  try {
    const connection = connectionData || await getConnectionData(connectionId)
    
    if (!connection) {
      console.error(`❌ No connection found for ID: ${connectionId}`)
      return
    }

    console.log(`🔍 Processing connection ${connectionId} for vehicle ${connection.smartcar_vehicle_id}`)

    // Fetch Smartcar data with improved error handling
    const vehicleData = await fetchSmartcarData(connection.smartcar_vehicle_id, connection.access_token, connection.id)
    
    if (!vehicleData || vehicleData.errors.length > 0) {
      console.error(`❌ Failed to fetch vehicle data for ${connection.smartcar_vehicle_id}:`, vehicleData?.errors || 'No data')
      
      // Check for stale trips even if we can't get fresh data
      await checkAndEndStaleTrips(connection)
      return
    }

    console.log(`✅ Successfully fetched data for ${connection.smartcar_vehicle_id}:`, {
      hasLocation: !!vehicleData.location,
      hasOdometer: !!vehicleData.odometer,
      timestamp: vehicleData.timestamp
    })

    // Get current vehicle state
    const lastState = await getVehicleState(connection.id)
    
    // Analyze and handle trip state with improved logic
    await analyzeTripState(connection, vehicleData, lastState)

  } finally {
    // Always release the lock
    processingLocks.delete(connectionId)
  }
}

async function getConnectionData(connectionId: string) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  const response = await fetch(`${supabaseUrl}/rest/v1/vehicle_connections?id=eq.${connectionId}&select=*`, {
    headers: {
      'Authorization': `Bearer ${supabaseServiceKey}`,
      'apikey': supabaseServiceKey,
      'Content-Type': 'application/json'
    }
  })

  if (!response.ok) return null
  
  const data = await response.json()
  return data.length > 0 ? data[0] : null
}

async function fetchSmartcarData(vehicleId: string, accessToken: string, connectionId?: string) {
  console.log(`🚗 Fetching Smartcar data for vehicle ${vehicleId}`)

  const [locationResponse, odometerResponse] = await Promise.all([
    fetch(`https://api.smartcar.com/v2.0/vehicles/${vehicleId}/location`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    }),
    fetch(`https://api.smartcar.com/v2.0/vehicles/${vehicleId}/odometer`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    })
  ])

  console.log(`📍 Location response: ${locationResponse.status}`)
  console.log(`🛣️ Odometer response: ${odometerResponse.status}`)

  const errors: string[] = []
  let location = null
  let odometer = null

  // Handle location response with token refresh
  if (locationResponse.status === 401 && connectionId) {
    const newToken = await refreshSmartcarToken(connectionId)
    if (newToken) {
      const retryResponse = await fetch(`https://api.smartcar.com/v2.0/vehicles/${vehicleId}/location`, {
        headers: { 'Authorization': `Bearer ${newToken}` }
      })
      
      if (retryResponse.ok) {
        location = await retryResponse.json()
        console.log(`✅ Location retrieved after token refresh`)
      } else {
        errors.push(`Location API error after refresh: ${retryResponse.status}`)
      }
    } else {
      errors.push('Failed to refresh token for location data')
    }
  } else if (locationResponse.ok) {
    location = await locationResponse.json()
    console.log(`✅ Location retrieved successfully`)
  } else {
    errors.push(`Location API error: ${locationResponse.status}`)
  }

  // Handle odometer response with token refresh
  if (odometerResponse.status === 401 && connectionId) {
    const newToken = await refreshSmartcarToken(connectionId)
    if (newToken) {
      const retryResponse = await fetch(`https://api.smartcar.com/v2.0/vehicles/${vehicleId}/odometer`, {
        headers: { 'Authorization': `Bearer ${newToken}` }
      })
      
      if (retryResponse.ok) {
        odometer = await retryResponse.json()
        console.log(`✅ Odometer retrieved after token refresh`)
      } else {
        errors.push(`Odometer API error after refresh: ${retryResponse.status}`)
      }
    } else {
      errors.push('Failed to refresh token for odometer data')
    }
  } else if (odometerResponse.ok) {
    odometer = await odometerResponse.json()
    console.log(`✅ Odometer retrieved successfully`)
  } else {
    errors.push(`Odometer API error: ${odometerResponse.status}`)
  }

  // Parse the responses
  if (location) {
    location = { latitude: location.latitude, longitude: location.longitude }
  }

  const finalData = {
    location,
    odometer,
    errors,
    timestamp: new Date().toISOString(),
    vehicleId
  }

  console.log(`📊 Final parsed data:`, {
    hasLocation: !!location,
    hasOdometer: !!odometer,
    odometerValue: odometer?.distance,
    errors: errors.length
  })

  return finalData
}

async function refreshSmartcarToken(connectionId: string): Promise<string | null> {
  console.log(`🔄 Attempting token refresh for connection ${connectionId}`)
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  
  try {
    // Get connection data for refresh token
    const connectionResponse = await fetch(`${supabaseUrl}/rest/v1/vehicle_connections?id=eq.${connectionId}&select=refresh_token`, {
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'apikey': supabaseServiceKey,
        'Content-Type': 'application/json'
      }
    })
    
    if (!connectionResponse.ok) {
      console.error('❌ Failed to fetch connection for token refresh')
      return null
    }
    
    const connections = await connectionResponse.json()
    if (connections.length === 0) {
      console.error('❌ No connection found for token refresh')
      return null
    }
    
    const refreshToken = connections[0].refresh_token
    const clientId = Deno.env.get('SMARTCAR_CLIENT_ID')!
    const clientSecret = Deno.env.get('SMARTCAR_CLIENT_SECRET')!
    
    // Call Smartcar token refresh endpoint
    const tokenResponse = await fetch('https://auth.smartcar.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`
      },
      body: `grant_type=refresh_token&refresh_token=${refreshToken}`
    })
    
    if (!tokenResponse.ok) {
      console.error(`❌ Token refresh failed: ${tokenResponse.status}`)
      return null
    }
    
    const tokenData = await tokenResponse.json()
    console.log('✅ Token refreshed successfully')
    
    // Update connection with new tokens
    const updateResponse = await fetch(`${supabaseUrl}/rest/v1/vehicle_connections?id=eq.${connectionId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'apikey': supabaseServiceKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        updated_at: new Date().toISOString()
      })
    })
    
    if (!updateResponse.ok) {
      console.error('❌ Failed to update connection with new tokens')
      return null
    }
    
    console.log('🔄 Connection updated with new tokens')
    return tokenData.access_token
    
  } catch (error) {
    console.error('❌ Token refresh error:', error)
    return null
  }
}

async function getVehicleState(connectionId: string): Promise<VehicleState | null> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  const response = await fetch(`${supabaseUrl}/rest/v1/vehicle_states?connection_id=eq.${connectionId}&select=*`, {
    headers: {
      'Authorization': `Bearer ${supabaseServiceKey}`,
      'apikey': supabaseServiceKey,
      'Content-Type': 'application/json'
    }
  })

  if (!response.ok) return null
  
  const data = await response.json()
  return data.length > 0 ? data[0] : null
}

async function analyzeTripState(connection: any, vehicleData: any, lastState: VehicleState | null) {
  console.log(`🔍 Analyzing trip state for vehicle ${connection.smartcar_vehicle_id}`)
  
  const currentLocation = vehicleData.location
  const currentOdometer = vehicleData.odometer?.distance
  const currentTime = new Date().toISOString()

  if (!currentOdometer) {
    console.log(`⚠️ No odometer data available, checking for stale trips only`)
    await checkAndEndStaleTrips(connection)
    return
  }

  // Check for existing active trips first (CRITICAL: prevent duplicates)
  const activeTrips = await getActiveTrips(connection.id)
  const hasActiveTrip = activeTrips.length > 0

  console.log(`🗂️ Current trip status:`, {
    activeTripsCount: activeTrips.length,
    hasActiveTrip,
    currentOdometer: `${currentOdometer}km`,
    lastOdometer: lastState?.last_odometer ? `${lastState.last_odometer}km` : 'none'
  })

  // Get user's trip configuration
  const tripConfig = await getUserTripConfig(connection.user_id)
  
  // Calculate movement distance (MUCH more conservative now)
  const movementDistance = lastState?.last_odometer ? 
    Math.abs(currentOdometer - lastState.last_odometer) * 1000 : 0 // Convert km to meters

  // STRICT movement detection - much higher threshold to prevent false positives
  const hasMovedSignificantly = !lastState?.last_odometer || 
    movementDistance >= tripConfig.movementThreshold

  console.log(`📏 Movement analysis:`, {
    movementDistance: `${movementDistance}m`,
    threshold: `${tripConfig.movementThreshold}m`,
    hasMovedSignificantly,
    sensitivity: tripConfig.sensitivity
  })

  // Handle existing active trip
  if (hasActiveTrip) {
    const activeTrip = activeTrips[0]
    
    // Safety check: Force end trips that are too old
    const tripStartTime = new Date(activeTrip.start_time)
    const tripDurationHours = (new Date().getTime() - tripStartTime.getTime()) / (1000 * 60 * 60)
    
    if (tripDurationHours >= tripConfig.maxDurationHours) {
      console.log(`⏰ Force-ending trip due to max duration (${tripDurationHours.toFixed(1)}h)`)
      await endTrip(activeTrip, currentLocation, currentOdometer, tripConfig, true)
      await updateVehicleState(connection.id, {
        last_odometer: currentOdometer,
        last_location: currentLocation,
        last_poll_time: currentTime,
        current_trip_id: null,
        polling_frequency: 120
      })
      return
    }

    // Check for stationary timeout - only end if stationary for extended period with minimal distance
    if (!hasMovedSignificantly) {
      // Calculate time since last movement (more precise than trip start time)
      const timeSinceLastPoll = lastState?.last_poll_time ? 
        (new Date().getTime() - new Date(lastState.last_poll_time).getTime()) / (1000 * 60) : 0
      
      // Only end trip if:
      // 1. Vehicle has been stationary for longer than timeout
      // 2. Trip has some meaningful distance (> 1km) 
      // 3. OR trip has been running for a very long time
      const tripStartTime = new Date(activeTrip.start_time)
      const tripDurationMinutes = (new Date().getTime() - tripStartTime.getTime()) / (1000 * 60)
      const tripDistance = activeTrip.distance_km || 0
      
      const shouldEndTrip = timeSinceLastPoll >= tripConfig.stationaryTimeout && 
                           (tripDistance >= 1.0 || tripDurationMinutes >= 60) // More than 1km OR 1 hour
      
      if (shouldEndTrip) {
        console.log(`🏁 Ending trip due to stationary timeout (${timeSinceLastPoll.toFixed(1)}min since last movement, distance: ${tripDistance}km)`)
        await endTrip(activeTrip, currentLocation, currentOdometer, tripConfig)
        await updateVehicleState(connection.id, {
          last_odometer: currentOdometer,
          last_location: currentLocation,
          last_poll_time: currentTime,
          current_trip_id: null,
          polling_frequency: 120
        })
        return
      } else {
        console.log(`⏸️ Trip continuing - stationary for ${timeSinceLastPoll.toFixed(1)}min (threshold: ${tripConfig.stationaryTimeout}min, distance: ${tripDistance}km)`)
        await updateOngoingTrip(activeTrip, currentLocation, currentOdometer)
      }
    } else {
      console.log(`🔄 Updating active trip with movement (${movementDistance}m)`)
      await updateOngoingTrip(activeTrip, currentLocation, currentOdometer)
    }
  } 
  // Start new trip ONLY if significant movement AND no active trip
  else if (hasMovedSignificantly && movementDistance > 0) {
    console.log(`🚗 STARTING new trip - movement detected: ${movementDistance}m (threshold: ${tripConfig.movementThreshold}m)`)
    
    try {
      const newTripId = await startNewTrip(connection, currentLocation, currentOdometer, tripConfig)
      console.log(`✅ New trip created: ${newTripId}`)
    } catch (error) {
      console.error(`❌ Failed to create trip:`, error)
    }
  } else {
    console.log(`⏸️ No trip action - movement: ${movementDistance}m (threshold: ${tripConfig.movementThreshold}m)`)
  }

  // Update vehicle state with conservative polling frequency
  let pollingFrequency = 120 // Default 2 minutes
  if (hasActiveTrip) {
    pollingFrequency = hasMovedSignificantly ? 30 : 60 // 30s when moving, 60s when stationary
  } else if (hasMovedSignificantly) {
    pollingFrequency = 60 // 1 minute when movement detected
  }

  const currentTripId = activeTrips.length > 0 ? activeTrips[0].id : null
  await updateVehicleState(connection.id, {
    last_odometer: currentOdometer,
    last_location: currentLocation,
    last_poll_time: currentTime,
    current_trip_id: currentTripId,
    polling_frequency: pollingFrequency
  })

  // Also log to history table for debugging
  await logVehicleDataHistory(connection.id, currentOdometer, currentLocation, currentTime)
}

async function getActiveTrips(connectionId: string) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  const response = await fetch(`${supabaseUrl}/rest/v1/sense_trips?vehicle_connection_id=eq.${connectionId}&trip_status=eq.active&select=*&order=start_time.desc`, {
    headers: {
      'Authorization': `Bearer ${supabaseServiceKey}`,
      'apikey': supabaseServiceKey,
      'Content-Type': 'application/json'
    }
  })

  return response.ok ? await response.json() : []
}

// Get user's trip configuration with realistic defaults for ID5 testing
async function getUserTripConfig(userId: string) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  const profileResponse = await fetch(`${supabaseUrl}/rest/v1/sense_profiles?id=eq.${userId}&select=trip_movement_threshold_meters,trip_stationary_timeout_minutes,trip_minimum_distance_meters,trip_max_duration_hours,trip_sensitivity_level`, {
    headers: {
      'Authorization': `Bearer ${supabaseServiceKey}`,
      'apikey': supabaseServiceKey,
      'Content-Type': 'application/json'
    }
  })

  const profiles = profileResponse.ok ? await profileResponse.json() : []
  const profile = profiles.length > 0 ? profiles[0] : {}

  // Realistic defaults for ID5 testing - balanced for proper trip detection
  return {
    movementThreshold: profile.trip_movement_threshold_meters || 200, // 200m - realistic for city driving
    stationaryTimeout: profile.trip_stationary_timeout_minutes || 3,   // 3min - reasonable stop time
    minimumDistance: profile.trip_minimum_distance_meters || 500,      // 500m - captures short trips
    maxDurationHours: profile.trip_max_duration_hours || 12,
    sensitivity: profile.trip_sensitivity_level || 'normal'            // Normal sensitivity for balanced detection
  }
}

async function checkAndEndStaleTrips(connection: any) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  
  const tripConfig = await getUserTripConfig(connection.user_id)
  
  // Find active trips older than max duration
  const maxDurationMs = tripConfig.maxDurationHours * 60 * 60 * 1000
  const cutoffTime = new Date(Date.now() - maxDurationMs).toISOString()
  
  const staleTripsResponse = await fetch(`${supabaseUrl}/rest/v1/sense_trips?vehicle_connection_id=eq.${connection.id}&trip_status=eq.active&start_time=lt.${cutoffTime}&select=*`, {
    headers: {
      'Authorization': `Bearer ${supabaseServiceKey}`,
      'apikey': supabaseServiceKey,
      'Content-Type': 'application/json'
    }
  })
  
  if (staleTripsResponse.ok) {
    const staleTrips = await staleTripsResponse.json()
    
    for (const trip of staleTrips) {
      console.log(`🧹 Force-ending stale trip ${trip.id}`)
      try {
        await endTrip(trip, trip.start_location, null, tripConfig, true)
        console.log(`✅ Stale trip ${trip.id} ended`)
      } catch (error) {
        console.error(`❌ Failed to end stale trip ${trip.id}:`, error)
      }
    }
  }
}

async function startNewTrip(connection: any, location: any, odometer: number, tripConfig: any) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  console.log(`🚗 Creating new trip for vehicle ${connection.smartcar_vehicle_id}`)

  // Use a default location if GPS is not available
  const startLocation = location || { latitude: 0, longitude: 0 }
  
  const tripData = {
    user_id: connection.user_id,
    vehicle_connection_id: connection.id,
    start_time: new Date().toISOString(),
    start_location: startLocation,
    trip_status: 'active',
    trip_type: 'unknown',
    odometer_km: odometer ? Math.round(odometer) : null,
    is_automatic: true,
    distance_km: 0,
    duration_minutes: 0
  }

  const tripResponse = await fetch(`${supabaseUrl}/rest/v1/sense_trips`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${supabaseServiceKey}`,
      'apikey': supabaseServiceKey,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify(tripData)
  })

  if (!tripResponse.ok) {
    const errorText = await tripResponse.text()
    console.error(`❌ Trip creation failed: ${errorText}`)
    throw new Error(`Trip creation failed: ${errorText}`)
  }

  const createdTrip = await tripResponse.json()
  const trip = Array.isArray(createdTrip) ? createdTrip[0] : createdTrip
  return trip.id
}

async function updateOngoingTrip(trip: any, location: any, odometer: number) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  const startOdometer = trip.odometer_km || 0
  const newDistance = Math.max(0, Math.round((odometer - startOdometer) * 100) / 100)
  
  const startTime = new Date(trip.start_time)
  const currentTime = new Date()
  const newDuration = Math.floor((currentTime.getTime() - startTime.getTime()) / (1000 * 60))

  const updates = {
    distance_km: newDistance,
    duration_minutes: newDuration,
    updated_at: currentTime.toISOString()
  }

  // Add location to route if available
  if (location && location.latitude && location.longitude) {
    const routeData = trip.route_data || []
    routeData.push([location.longitude, location.latitude])
    updates.route_data = routeData
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

async function endTrip(trip: any, location: any, odometer: number | null, tripConfig: any, forced = false) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  console.log(`🏁 Ending trip ${trip.id} (forced: ${forced})`)

  const endLocation = location || trip.start_location
  const endOdometer = odometer || trip.odometer_km || 0
  const startOdometer = trip.odometer_km || 0
  
  const finalDistance = Math.max(0, Math.round((endOdometer - startOdometer) * 100) / 100)
  const startTime = new Date(trip.start_time)
  const endTime = new Date()
  const finalDuration = Math.floor((endTime.getTime() - startTime.getTime()) / (1000 * 60))

  const updates = {
    trip_status: 'completed',
    end_time: endTime.toISOString(),
    end_location: endLocation,
    distance_km: finalDistance,
    duration_minutes: finalDuration,
    updated_at: endTime.toISOString()
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

  console.log(`✅ Trip ${trip.id} ended - Distance: ${finalDistance}km, Duration: ${finalDuration}min`)
}

async function updateVehicleState(connectionId: string, state: any) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  // Try to update existing state
  const updateResponse = await fetch(`${supabaseUrl}/rest/v1/vehicle_states?connection_id=eq.${connectionId}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${supabaseServiceKey}`,
      'apikey': supabaseServiceKey,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify({
      ...state,
      updated_at: new Date().toISOString()
    })
  })

  // If no rows were updated, create new state
  if (updateResponse.ok) {
    const responseText = await updateResponse.text()
    if (!responseText || responseText.trim() === '') {
      // No rows updated, create new state
      await fetch(`${supabaseUrl}/rest/v1/vehicle_states`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'apikey': supabaseServiceKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          connection_id: connectionId,
          ...state,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
      })
    }
  }
}

async function logVehicleDataHistory(connectionId: string, odometer: number, location: any, pollTime: string) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  try {
    await fetch(`${supabaseUrl}/rest/v1/vehicle_data_history`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'apikey': supabaseServiceKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        connection_id: connectionId,
        odometer_km: odometer,
        location: location,
        poll_time: pollTime,
        created_at: new Date().toISOString()
      })
    })
    
    console.log(`📊 Logged data point: ${odometer}km at ${pollTime}`)
  } catch (error) {
    console.error('❌ Failed to log vehicle data history:', error)
  }
}
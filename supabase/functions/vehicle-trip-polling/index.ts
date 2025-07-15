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
  const vehicleData = await fetchSmartcarData(connection.smartcar_vehicle_id, connection.access_token, connectionId)
  
  // Get last known state from database
  const lastState = await getVehicleState(connectionId)
  
  // Analyze trip state and update database
  await analyzeTripState(connection, vehicleData, lastState)
}

async function fetchSmartcarData(vehicleId: string, accessToken: string, connectionId?: string) {
  console.log(`🚗 Fetching Smartcar data for vehicle ${vehicleId}`)
  
  try {
    const [locationRes, odometerRes] = await Promise.all([
      fetch(`https://api.smartcar.com/v2.0/vehicles/${vehicleId}/location`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      }),
      
      fetch(`https://api.smartcar.com/v2.0/vehicles/${vehicleId}/odometer`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      })
    ])

    console.log(`📍 Location response status: ${locationRes.status}`)
    console.log(`🛣️ Odometer response status: ${odometerRes.status}`)

    // Check if we need to refresh tokens (401 Unauthorized)
    if ((locationRes.status === 401 || odometerRes.status === 401) && connectionId) {
      console.log(`🔄 Token expired, attempting refresh for connection ${connectionId}`)
      const newAccessToken = await refreshSmartcarToken(connectionId)
      if (newAccessToken) {
        console.log(`✅ Token refreshed, retrying API calls`)
        return await fetchSmartcarData(vehicleId, newAccessToken, connectionId)
      } else {
        console.error(`❌ Token refresh failed for connection ${connectionId}`)
      }
    }

    const data: any = {
      location: null,
      odometer: null,
      errors: [],
      timestamp: new Date().toISOString(),
      vehicleId
    }

    if (locationRes.ok) {
      const locationData = await locationRes.json()
      console.log(`✅ Raw location response:`, JSON.stringify(locationData, null, 2))
      
      // Smartcar API returns data directly in the response root
      data.location = {
        latitude: locationData.latitude,
        longitude: locationData.longitude
      }
      console.log(`📍 Parsed location:`, data.location)
    } else {
      const locationError = await locationRes.text()
      console.error(`❌ Location error (${locationRes.status}):`, locationError)
      data.errors.push(`Location: ${locationError}`)
    }

    if (odometerRes.ok) {
      const odometerData = await odometerRes.json()
      console.log(`✅ Raw odometer response:`, JSON.stringify(odometerData, null, 2))
      
      // Smartcar API returns data directly in the response root
      data.odometer = {
        distance: odometerData.distance
      }
      console.log(`🛣️ Parsed odometer:`, data.odometer)
    } else {
      const odometerError = await odometerRes.text()
      console.error(`❌ Odometer error (${odometerRes.status}):`, odometerError)
      data.errors.push(`Odometer: ${odometerError}`)
    }

    console.log(`📊 Final data:`, data)
    return data

  } catch (error) {
    console.error('❌ Fetch error:', error)
    return {
      location: null,
      odometer: null,
      errors: [`Network error: ${error.message}`]
    }
  }
}

async function refreshSmartcarToken(connectionId: string): Promise<string | null> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const smartcarClientId = Deno.env.get('SMARTCAR_CLIENT_ID')!
  const smartcarClientSecret = Deno.env.get('SMARTCAR_CLIENT_SECRET')!

  try {
    // Get the current connection data with refresh token
    const connectionResponse = await fetch(`${supabaseUrl}/rest/v1/vehicle_connections?id=eq.${connectionId}&select=refresh_token`, {
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'apikey': supabaseServiceKey,
        'Content-Type': 'application/json'
      }
    })

    if (!connectionResponse.ok) {
      console.error('Failed to fetch connection data for token refresh')
      return null
    }

    const connections = await connectionResponse.json()
    if (connections.length === 0) {
      console.error('Connection not found for token refresh')
      return null
    }

    const refreshToken = connections[0].refresh_token

    // Request new access token from Smartcar
    const tokenResponse = await fetch('https://auth.smartcar.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${btoa(`${smartcarClientId}:${smartcarClientSecret}`)}`
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken
      })
    })

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      console.error(`Failed to refresh token: ${tokenResponse.status} - ${errorText}`)
      return null
    }

    const tokenData = await tokenResponse.json()
    const newAccessToken = tokenData.access_token
    const newRefreshToken = tokenData.refresh_token || refreshToken // Use new refresh token if provided

    // Update the connection with new tokens
    const updateResponse = await fetch(`${supabaseUrl}/rest/v1/vehicle_connections?id=eq.${connectionId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'apikey': supabaseServiceKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        access_token: newAccessToken,
        refresh_token: newRefreshToken,
        updated_at: new Date().toISOString()
      })
    })

    if (!updateResponse.ok) {
      console.error('Failed to update connection with new tokens')
      return null
    }

    console.log(`✅ Successfully refreshed tokens for connection ${connectionId}`)
    return newAccessToken

  } catch (error) {
    console.error('Error refreshing Smartcar token:', error)
    return null
  }
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

/**
 * CORE TRIP DETECTION ALGORITHM
 * 
 * This function implements the main trip detection logic using configurable thresholds.
 * 
 * Algorithm Overview:
 * 1. Get user's trip configuration (thresholds, timeouts, etc.)
 * 2. Calculate vehicle movement since last poll
 * 3. Apply trip state machine logic:
 *    - No trip + movement → Start new trip (pending)
 *    - Active trip + movement → Update trip
 *    - Active trip + stationary → End trip (if timeout reached)
 * 4. Apply safety mechanisms (max duration, min distance)
 * 5. Update vehicle state with dynamic polling frequency
 * 
 * @param connection Vehicle connection data from database
 * @param vehicleData Current vehicle data from Smartcar API
 * @param lastState Previous vehicle state from database
 */
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

  // Get user's trip configuration from profile
  const tripConfig = await getUserTripConfig(connection.user_id)
  
  // Calculate movement distance
  const movementDistance = lastState?.last_odometer ? 
    Math.abs(currentOdometer - lastState.last_odometer) : 0

  const hasMovedSignificantly = lastState?.last_odometer ? 
    movementDistance >= tripConfig.movementThreshold :
    true // If no previous state, assume movement

  console.log(`🔍 Movement analysis for vehicle ${connection.smartcar_vehicle_id}:`, {
    currentOdometer,
    lastOdometer: lastState?.last_odometer,
    movementDistance: `${movementDistance}m`,
    threshold: `${tripConfig.movementThreshold}m`,
    hasMovedSignificantly,
    sensitivity: tripConfig.sensitivity
  });

  // Check for active trips
  const activeTripsResponse = await fetch(`${supabaseUrl}/rest/v1/sense_trips?vehicle_connection_id=eq.${connection.id}&trip_status=in.(active,pending)&select=*,created_at`, {
    headers: {
      'Authorization': `Bearer ${supabaseServiceKey}`,
      'apikey': supabaseServiceKey,
      'Content-Type': 'application/json'
    }
  })

  const activeTrips = activeTripsResponse.ok ? await activeTripsResponse.json() : []
  const hasActiveTrip = activeTrips.length > 0

  console.log(`🗂️ Trip status for vehicle ${connection.smartcar_vehicle_id}:`, {
    hasMovedSignificantly,
    hasActiveTrip,
    activeTripsCount: activeTrips.length,
    movementThreshold: tripConfig.movementThreshold
  });

  if (hasActiveTrip) {
    const activeTrip = activeTrips[0]
    
    // Check for trip timeout (safety mechanism)
    const tripDuration = new Date().getTime() - new Date(activeTrip.created_at).getTime()
    const maxDurationMs = tripConfig.maxDurationHours * 60 * 60 * 1000
    
    if (tripDuration > maxDurationMs) {
      console.log(`⏰ Trip ${activeTrip.id} exceeded max duration (${tripConfig.maxDurationHours}h), forcing completion`)
      await endTrip(activeTrip, currentLocation, currentOdometer, tripConfig, true)
    } else if (hasMovedSignificantly) {
      // Update ongoing trip
      console.log(`📍 Updating ongoing trip ${activeTrip.id} (moved ${movementDistance}m)`)
      await updateOngoingTrip(activeTrip, currentLocation, currentOdometer)
      
      // Promote from pending to active if enough movement
      if (activeTrip.trip_status === 'pending' && movementDistance >= tripConfig.movementThreshold * 2) {
        await promoteTripToActive(activeTrip.id)
      }
    } else {
      // Check if vehicle has been stationary long enough to end trip
      const timeSinceLastPoll = lastState?.last_poll_time ? 
        new Date().getTime() - new Date(lastState.last_poll_time).getTime() : 0
      
      const stationaryTimeoutMs = tripConfig.stationaryTimeout * 60 * 1000
      
      if (timeSinceLastPoll > stationaryTimeoutMs) {
        console.log(`🏁 Ending trip ${activeTrip.id} - vehicle stationary for ${tripConfig.stationaryTimeout}+ minutes`)
        await endTrip(activeTrip, currentLocation, currentOdometer, tripConfig)
      } else {
        console.log(`⏸️ Vehicle stationary for ${Math.round(timeSinceLastPoll/1000/60)}min (timeout: ${tripConfig.stationaryTimeout}min)`)
      }
    }
  } else if (hasMovedSignificantly) {
    // Start new trip
    console.log(`🚗 Starting new trip for vehicle ${connection.smartcar_vehicle_id} (moved ${movementDistance}m, threshold: ${tripConfig.movementThreshold}m)`)
    console.log(`🔧 Trip start conditions:`, {
      hasMovedSignificantly,
      movementDistance,
      threshold: tripConfig.movementThreshold,
      currentLocation,
      currentOdometer,
      userId: connection.user_id,
      vehicleConnectionId: connection.id
    })
    
    try {
      await startNewTrip(connection, currentLocation, currentOdometer, tripConfig)
      console.log(`✅ Trip creation attempt completed`)
    } catch (error) {
      console.error(`❌ Trip creation failed:`, error)
    }
  } else {
    console.log(`⏸️ No significant movement detected (${movementDistance}m < ${tripConfig.movementThreshold}m threshold)`)
  }

  // Dynamic polling frequency based on trip state and movement
  let pollingFrequency = 120 // Default 2 minutes
  if (hasActiveTrip) {
    pollingFrequency = hasMovedSignificantly ? 15 : 30 // 15s when moving, 30s when stationary
  } else if (hasMovedSignificantly) {
    pollingFrequency = 30 // More frequent when movement detected but no trip
  }

  // Update vehicle state
  await updateVehicleState(connection.id, {
    last_odometer: currentOdometer,
    last_location: currentLocation,
    last_poll_time: currentTime,
    current_trip_id: hasActiveTrip ? activeTrips[0].id : null,
    polling_frequency: pollingFrequency
  })
}

// Get user's trip configuration from their profile
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

  // Return configuration with defaults - TEMPORARY: Lower thresholds for testing
  return {
    movementThreshold: profile.trip_movement_threshold_meters || 10, // Lowered from 100m to 10m
    stationaryTimeout: profile.trip_stationary_timeout_minutes || 0.5, // Lowered from 2min to 30s
    minimumDistance: profile.trip_minimum_distance_meters || 500,
    maxDurationHours: profile.trip_max_duration_hours || 12,
    sensitivity: profile.trip_sensitivity_level || 'normal'
  }
}

async function startNewTrip(connection: any, location: any, odometer: number, tripConfig: any) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  console.log(`🚗 Starting trip creation process...`)
  console.log(`📋 Trip input data:`, {
    connectionId: connection.id,
    userId: connection.user_id,
    vehicleId: connection.smartcar_vehicle_id,
    location,
    odometer,
    tripConfig
  })

  // Start as 'pending' for small movements, 'active' for significant movements
  const movementDistance = 0 // We'll calculate this if we have previous state
  const status = movementDistance >= tripConfig.movementThreshold * 2 ? 'active' : 'pending'

  const tripData = {
    user_id: connection.user_id,
    vehicle_connection_id: connection.id,
    start_time: new Date().toISOString(),
    start_location: location || {},
    trip_status: status,
    trip_type: 'unknown',
    odometer_km: odometer ? Math.round(odometer / 1000) : null,
    is_automatic: true
  }

  console.log(`🆕 Creating new trip with status: ${status}`)
  console.log(`📦 Trip data being sent:`, JSON.stringify(tripData, null, 2))
  
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/sense_trips`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'apikey': supabaseServiceKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(tripData)
    })
    
    console.log(`📡 Trip creation response status: ${response.status}`)
    
    if (response.ok) {
      const result = await response.json()
      console.log(`✅ Trip created successfully:`, result)
      return result
    } else {
      const errorText = await response.text()
      console.error(`❌ Trip creation failed (${response.status}):`, errorText)
      throw new Error(`Trip creation failed: ${errorText}`)
    }
  } catch (error) {
    console.error(`❌ Error in startNewTrip:`, error)
    throw error
  }
}

async function promoteTripToActive(tripId: string) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  console.log(`⬆️ Promoting trip ${tripId} from pending to active`)
  await fetch(`${supabaseUrl}/rest/v1/sense_trips?id=eq.${tripId}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${supabaseServiceKey}`,
      'apikey': supabaseServiceKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      trip_status: 'active',
      updated_at: new Date().toISOString()
    })
  })
}

async function updateOngoingTrip(trip: any, location: any, odometer: number) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  const startOdometer = trip.odometer_km ? trip.odometer_km * 1000 : 0
  const distanceKm = odometer > startOdometer ? (odometer - startOdometer) / 1000 : 0
  const durationMinutes = Math.floor((new Date().getTime() - new Date(trip.start_time).getTime()) / (1000 * 60))

  // Get existing route data or initialize empty array
  const existingRouteData = trip.route_data || []
  
  // Add current location to route data (GeoJSON LineString format: [longitude, latitude])
  const newRoutePoint = [location.longitude, location.latitude]
  
  // Only add if it's different from the last point (avoid duplicates)
  const shouldAddPoint = existingRouteData.length === 0 || 
    (existingRouteData.length > 0 && 
     (Math.abs(existingRouteData[existingRouteData.length - 1][0] - newRoutePoint[0]) > 0.0001 ||
      Math.abs(existingRouteData[existingRouteData.length - 1][1] - newRoutePoint[1]) > 0.0001))
  
  const updatedRouteData = shouldAddPoint ? [...existingRouteData, newRoutePoint] : existingRouteData

  console.log(`🔄 Updating trip ${trip.id}: distance=${distanceKm.toFixed(1)}km, duration=${durationMinutes}min, route points=${updatedRouteData.length}`)

  const updates = {
    end_location: location,
    route_data: updatedRouteData,
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

async function endTrip(trip: any, location: any, odometer: number, tripConfig: any, forced = false) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  const startOdometer = trip.odometer_km ? trip.odometer_km * 1000 : 0
  const distanceKm = odometer > startOdometer ? (odometer - startOdometer) / 1000 : 0
  const durationMinutes = Math.floor((new Date().getTime() - new Date(trip.start_time).getTime()) / (1000 * 60))
  const distanceMeters = distanceKm * 1000

  console.log(`🏁 Ending trip ${trip.id}: distance=${distanceKm}km, duration=${durationMinutes}min, minDistance=${tripConfig.minimumDistance}m`)

  // Check if trip meets minimum requirements (unless forced)
  if (!forced && distanceMeters < tripConfig.minimumDistance) {
    console.log(`🗑️ Trip ${trip.id} too short (${distanceMeters}m < ${tripConfig.minimumDistance}m), deleting instead of completing`)
    
    // Delete short trip instead of completing it
    await fetch(`${supabaseUrl}/rest/v1/sense_trips?id=eq.${trip.id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'apikey': supabaseServiceKey,
        'Content-Type': 'application/json'
      }
    })
    return
  }

  const updates = {
    end_time: new Date().toISOString(),
    end_location: location || {},
    distance_km: Math.round(distanceKm * 100) / 100,
    duration_minutes: durationMinutes,
    trip_status: 'completed',
    updated_at: new Date().toISOString()
  }

  console.log(`✅ Completing trip ${trip.id} with ${distanceKm}km distance`)
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
    last_odometer: state.last_odometer,
    last_location: state.last_location,
    last_poll_time: state.last_poll_time,
    current_trip_id: state.current_trip_id,
    polling_frequency: state.polling_frequency || 120,
    updated_at: new Date().toISOString()
  }

  console.log('📝 Updating vehicle state:', stateData)

  try {
    // First try to update existing record
    const updateResponse = await fetch(`${supabaseUrl}/rest/v1/vehicle_states?connection_id=eq.${connectionId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'apikey': supabaseServiceKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        last_odometer: state.last_odometer,
        last_location: state.last_location,
        last_poll_time: state.last_poll_time,
        current_trip_id: state.current_trip_id,
        polling_frequency: state.polling_frequency || 120,
        updated_at: new Date().toISOString()
      })
    })

    if (updateResponse.ok) {
      // Check if there's content to parse
      const responseText = await updateResponse.text()
      let result = []
      if (responseText) {
        try {
          result = JSON.parse(responseText)
        } catch (e) {
          console.log('📝 Empty response from update (expected for successful PATCH)')
        }
      }
      
      if (result.length === 0) {
        // No rows updated, record doesn't exist - create new one
        console.log('🔄 No existing record found, creating new one')
        const insertResponse = await fetch(`${supabaseUrl}/rest/v1/vehicle_states`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'apikey': supabaseServiceKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(stateData)
        })

        if (!insertResponse.ok) {
          const error = await insertResponse.text()
          console.error('❌ Failed to insert vehicle state:', error)
        } else {
          console.log('✅ Vehicle state created successfully')
        }
      } else {
        console.log('✅ Vehicle state updated successfully')
      }
    } else {
      const error = await updateResponse.text()
      console.error('❌ Failed to update vehicle state:', error)
    }
  } catch (error) {
    console.error('❌ Error updating vehicle state:', error)
  }
}
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
    console.error('Error in vehicle polling:', error);
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
    console.error('Failed to fetch connections')
    return
  }

  const connections = await connectionsResponse.json()
  console.log(`📡 Found ${connections.length} vehicle connections`)

  // Poll each vehicle
  for (const connection of connections) {
    try {
      console.log(`Polling vehicle ${connection.smartcar_vehicle_id}`)
      await pollSingleVehicle(connection.id, connection)
    } catch (error) {
      console.error(`Error polling vehicle ${connection.smartcar_vehicle_id}:`, error)
    }
  }
}

async function pollSingleVehicle(connectionId: string, connectionData?: any) {
  const connection = connectionData || await getConnectionData(connectionId)
  
  if (!connection) {
    console.error(`❌ No connection found for ID: ${connectionId}`)
    return
  }

  // Fetch Smartcar data
  const vehicleData = await fetchSmartcarData(connection.smartcar_vehicle_id, connection.access_token, connection.id)
  
  if (!vehicleData || vehicleData.errors.length > 0) {
    console.error(`❌ Failed to fetch vehicle data:`, vehicleData?.errors)
    return
  }

  // Get current vehicle state
  const lastState = await getVehicleState(connection.id)
  
  // Analyze and handle trip state
  await analyzeTripState(connection, vehicleData, lastState)
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

  const locationResponse = await fetch(`https://api.smartcar.com/v2.0/vehicles/${vehicleId}/location`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  })

  const odometerResponse = await fetch(`https://api.smartcar.com/v2.0/vehicles/${vehicleId}/odometer`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  })

  console.log(`📍 Location response status: ${locationResponse.status}`)
  console.log(`🛣️ Odometer response status: ${odometerResponse.status}`)

  const errors: string[] = []
  let location = null
  let odometer = null

  // Handle location response
  if (locationResponse.status === 401 && connectionId) {
    const newToken = await refreshSmartcarToken(connectionId)
    if (newToken) {
      // Retry with new token
      const retryLocationResponse = await fetch(`https://api.smartcar.com/v2.0/vehicles/${vehicleId}/location`, {
        headers: {
          'Authorization': `Bearer ${newToken}`
        }
      })
      
      if (retryLocationResponse.ok) {
        location = await retryLocationResponse.json()
        console.log(`✅ Raw location response:`, location)
      } else {
        errors.push(`Location API error after refresh: ${retryLocationResponse.status}`)
      }
    } else {
      errors.push('Failed to refresh token for location data')
    }
  } else if (locationResponse.ok) {
    location = await locationResponse.json()
    console.log(`✅ Raw location response:`, location)
  } else {
    errors.push(`Location API error: ${locationResponse.status}`)
  }

  // Handle odometer response
  if (odometerResponse.status === 401 && connectionId) {
    const newToken = await refreshSmartcarToken(connectionId)
    if (newToken) {
      // Retry with new token
      const retryOdometerResponse = await fetch(`https://api.smartcar.com/v2.0/vehicles/${vehicleId}/odometer`, {
        headers: {
          'Authorization': `Bearer ${newToken}`
        }
      })
      
      if (retryOdometerResponse.ok) {
        odometer = await retryOdometerResponse.json()
        console.log(`✅ Raw odometer response:`, odometer)
      } else {
        errors.push(`Odometer API error after refresh: ${retryOdometerResponse.status}`)
      }
    } else {
      errors.push('Failed to refresh token for odometer data')
    }
  } else if (odometerResponse.ok) {
    odometer = await odometerResponse.json()
    console.log(`✅ Raw odometer response:`, odometer)
  } else {
    errors.push(`Odometer API error: ${odometerResponse.status}`)
  }

  // Parse the responses
  if (location) {
    location = { latitude: location.latitude, longitude: location.longitude }
    console.log(`📍 Parsed location:`, location)
  }

  if (odometer) {
    console.log(`🛣️ Parsed odometer:`, odometer)
  }

  const finalData = {
    location,
    odometer,
    errors,
    timestamp: new Date().toISOString(),
    vehicleId
  }

  console.log(`📊 Final data:`, finalData)
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
    console.log(`⚠️ No odometer data available, skipping trip analysis`)
    
    // Check for stale active trips that need to be ended due to API issues
    await checkAndEndStaleTrips(connection)
    return
  }

  // Check for existing active trips
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  // Fetch active trips for this vehicle
  const tripsResponse = await fetch(`${supabaseUrl}/rest/v1/sense_trips?vehicle_connection_id=eq.${connection.id}&trip_status=eq.active&select=*`, {
    headers: {
      'Authorization': `Bearer ${supabaseServiceKey}`,
      'apikey': supabaseServiceKey,
      'Content-Type': 'application/json'
    }
  })

  const activeTrips = tripsResponse.ok ? await tripsResponse.json() : []
  const hasActiveTrip = activeTrips.length > 0

  console.log(`🗂️ Trip status for vehicle ${connection.smartcar_vehicle_id}:`, {
    hasActiveTrip,
    activeTripsCount: activeTrips.length,
  })

  // Get user's trip configuration from profile
  const tripConfig = await getUserTripConfig(connection.user_id)
  
  // Calculate movement distance based on odometer
  const movementDistance = lastState?.last_odometer ? 
    Math.abs(currentOdometer - lastState.last_odometer) * 1000 : 0 // Convert km to meters

  // For odometer-based detection: consider significant movement if:
  // 1. No previous state exists (first reading)
  // 2. Odometer has changed by threshold amount
  const hasMovedSignificantly = !lastState?.last_odometer || 
    movementDistance >= tripConfig.movementThreshold

  console.log(`🔍 Movement analysis for vehicle ${connection.smartcar_vehicle_id}:`, {
    currentOdometer,
    lastOdometer: lastState?.last_odometer,
    movementDistance: `${movementDistance}m`,
    threshold: `${tripConfig.movementThreshold}m`,
    hasMovedSignificantly,
    sensitivity: tripConfig.sensitivity
  })

  // Decision logic for trip management
  if (hasActiveTrip) {
    const activeTrip = activeTrips[0]
    
    // Check for trip max duration safety limit
    const tripStartTime = new Date(activeTrip.start_time)
    const tripDurationHours = (new Date().getTime() - tripStartTime.getTime()) / (1000 * 60 * 60)
    
    if (tripDurationHours >= tripConfig.maxDurationHours) {
      console.log(`⏰ Trip exceeded max duration (${tripDurationHours.toFixed(1)}h ≥ ${tripConfig.maxDurationHours}h), force ending`)
      
      try {
        await endTrip(activeTrip, currentLocation, currentOdometer, tripConfig, true)
        console.log(`✅ Trip ${activeTrip.id} force-ended due to max duration`)
        
        await updateVehicleState(connection.id, {
          last_odometer: currentOdometer,
          last_location: currentLocation,
          last_poll_time: currentTime,
          current_trip_id: null,
          polling_frequency: 120
        })
        return
      } catch (error) {
        console.error(`❌ Failed to force-end trip:`, error)
      }
    }
    
    // Check if vehicle has been stationary too long
    const currentTimeObj = new Date()
    
    if (!hasMovedSignificantly) {
      // Calculate time since trip started (more reliable for stationary detection)
      const timeSinceTripStart = (currentTimeObj.getTime() - tripStartTime.getTime()) / (1000 * 60)
      
      // Use a simple approach: if the trip has been running for more than 2 minutes 
      // AND no significant movement in this poll, consider ending it
      const stationaryThreshold = tripConfig.stationaryTimeout
      
      console.log(`⏱️ Stationary check: trip running for ${timeSinceTripStart.toFixed(1)}min, no movement this poll, threshold: ${stationaryThreshold}min`)
      
      if (timeSinceTripStart >= stationaryThreshold) {
        console.log(`🏁 Trip running for ${timeSinceTripStart.toFixed(1)}min without movement (≥${stationaryThreshold}min), ending trip`)
        
        try {
          await endTrip(activeTrip, currentLocation, currentOdometer, tripConfig)
          console.log(`✅ Trip ${activeTrip.id} ended due to stationary timeout`)
          
          // Clear the current trip ID since we ended it
          await updateVehicleState(connection.id, {
            last_odometer: currentOdometer,
            last_location: currentLocation,
            last_poll_time: currentTime,
            current_trip_id: null,
            polling_frequency: 120 // Back to normal polling
          })
          return
        } catch (error) {
          console.error(`❌ Failed to end trip:`, error)
        }
      } else {
        // Update existing trip with new data even if no movement
        await updateOngoingTrip(activeTrip, currentLocation, currentOdometer)
        console.log(`🔄 Updated ongoing trip ${activeTrip.id} with new odometer: ${currentOdometer}km (no movement)`)
      }
    } else {
      // Update existing trip with new data
      await updateOngoingTrip(activeTrip, currentLocation, currentOdometer)
      console.log(`🔄 Updated ongoing trip ${activeTrip.id} with new odometer: ${currentOdometer}km`)
    }
  } else if (hasMovedSignificantly) {
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
      const newTripId = await startNewTrip(connection, currentLocation, currentOdometer, tripConfig)
      console.log(`✅ Trip creation completed with ID: ${newTripId}`)
      
      // Update the hasActiveTrip flag since we just created one
      activeTrips.push({ id: newTripId })
    } catch (error) {
      console.error(`❌ Trip creation failed:`, error)
    }
  } else {
    console.log(`⏸️ No significant movement detected (${movementDistance}m < ${tripConfig.movementThreshold}m threshold)`)
  }

  // Dynamic polling frequency based on trip state and movement
  let pollingFrequency = 120 // Default 2 minutes
  if (hasActiveTrip || activeTrips.length > 0) {
    pollingFrequency = hasMovedSignificantly ? 15 : 30 // 15s when moving, 30s when stationary
  } else if (hasMovedSignificantly) {
    pollingFrequency = 30 // More frequent when movement detected but no trip
  }

  // Update vehicle state with current trip ID
  const currentTripId = activeTrips.length > 0 ? activeTrips[0].id : null
  await updateVehicleState(connection.id, {
    last_odometer: currentOdometer,
    last_location: currentLocation,
    last_poll_time: currentTime,
    current_trip_id: currentTripId,
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

  // Return configuration with defaults
  return {
    movementThreshold: profile.trip_movement_threshold_meters || 100, // Back to normal 100m
    stationaryTimeout: profile.trip_stationary_timeout_minutes || 2, // Back to normal 2min
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

  // Use a default location if GPS is not available (Smartcar simulator issue)
  const startLocation = location || { latitude: 0, longitude: 0 }
  
  const tripData = {
    user_id: connection.user_id,
    vehicle_connection_id: connection.id,
    start_time: new Date().toISOString(),
    start_location: startLocation,
    trip_status: 'active', // Always start as active for odometer-based trips
    trip_type: 'unknown',
    odometer_km: odometer ? Math.round(odometer) : null, // Keep as km, no conversion needed
    is_automatic: true,
    distance_km: 0,
    duration_minutes: 0
  }

  console.log(`🆕 Creating new trip with status: active`)
  console.log(`📦 Trip data being sent:`, JSON.stringify(tripData, null, 2))

  // Create the trip
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

  console.log(`📡 Trip creation response status: ${tripResponse.status}`)

  if (!tripResponse.ok) {
    const errorText = await tripResponse.text()
    console.error(`❌ Trip creation failed (${tripResponse.status}): ${errorText}`)
    throw new Error(`Trip creation failed: ${errorText}`)
  }

  const createdTrip = await tripResponse.json()
  console.log(`✅ Trip created successfully:`, createdTrip)

  // If it's an array, get the first item
  const trip = Array.isArray(createdTrip) ? createdTrip[0] : createdTrip
  return trip.id
}

async function updateOngoingTrip(trip: any, location: any, odometer: number) {
  console.log(`🔄 Updating ongoing trip ${trip.id}`)
  
  // Calculate new distance (km) and duration (minutes)
  const startOdometer = trip.odometer_km || 0
  const newDistance = Math.max(0, Math.round((odometer - startOdometer) * 100) / 100) // Round to 2 decimals
  
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

  console.log(`📊 Trip update data:`, {
    tripId: trip.id,
    startOdometer,
    currentOdometer: odometer,
    newDistance,
    newDuration,
    routePoints: updates.route_data?.length || 0
  })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  const updateResponse = await fetch(`${supabaseUrl}/rest/v1/sense_trips?id=eq.${trip.id}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${supabaseServiceKey}`,
      'apikey': supabaseServiceKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(updates)
  })

  if (!updateResponse.ok) {
    const errorText = await updateResponse.text()
    console.error(`❌ Failed to update trip: ${errorText}`)
    throw new Error(`Trip update failed: ${errorText}`)
  }

  console.log(`✅ Trip updated - Distance: ${newDistance}km, Duration: ${newDuration}min`)
}

// Check for stale active trips that need to be ended due to API issues
async function checkAndEndStaleTrips(connection: any) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  
  // Get user's trip configuration
  const tripConfig = await getUserTripConfig(connection.user_id)
  
  // Find active trips that are older than max duration
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
      console.log(`🧹 Force-ending stale trip ${trip.id} (started: ${trip.start_time})`)
      
      try {
        await endTrip(trip, trip.start_location, null, tripConfig, true)
        console.log(`✅ Stale trip ${trip.id} ended successfully`)
      } catch (error) {
        console.error(`❌ Failed to end stale trip ${trip.id}:`, error)
      }
    }
  }
}

async function endTrip(trip: any, location: any, odometer: number, tripConfig: any, forced = false) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  const startOdometer = trip.odometer_km || 0
  const newDistance = Math.max(0, Math.round((odometer - startOdometer) * 100) / 100)
  
  const startTime = new Date(trip.start_time)
  const currentTime = new Date()
  const newDuration = Math.floor((currentTime.getTime() - startTime.getTime()) / (1000 * 60))
  const distanceMeters = newDistance * 1000

  console.log(`🏁 Ending trip ${trip.id}: distance=${newDistance}km, duration=${newDuration}min, minDistance=${tripConfig.minimumDistance}m`)

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
    distance_km: newDistance,
    duration_minutes: newDuration,
    trip_status: 'completed',
    updated_at: new Date().toISOString()
  }

  console.log(`✅ Completing trip ${trip.id} with ${newDistance}km distance`)
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

  // First try to update existing record
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

  if (!updateResponse.ok) {
    // If update failed, try to create new record
    console.log(`🔄 No existing record found, creating new one`)
    
    const insertResponse = await fetch(`${supabaseUrl}/rest/v1/vehicle_states`, {
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

    if (!insertResponse.ok) {
      const errorText = await insertResponse.text()
      console.error(`❌ Failed to insert vehicle state: ${errorText}`)
      return
    }
  }

  console.log(`📝 Updating vehicle state:`, {
    connection_id: connectionId,
    ...state,
    updated_at: new Date().toISOString()
  })
}
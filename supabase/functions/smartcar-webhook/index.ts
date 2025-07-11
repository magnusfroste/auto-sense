import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, sc-signature',
}

interface SmartcarWebhookData {
  eventType: string
  vehicleId: string
  userId?: string
  timestamp: string
  data?: any
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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const smartcarClientSecret = Deno.env.get('SMARTCAR_CLIENT_SECRET')!

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Verify webhook signature (implement if needed)
    // const signature = req.headers.get('sc-signature')
    
    const webhookData: SmartcarWebhookData = await req.json()
    console.log('Received webhook:', webhookData.eventType, 'for vehicle:', webhookData.vehicleId)

    // Find the vehicle connection
    const { data: connection, error: connectionError } = await supabase
      .from('vehicle_connections')
      .select('*')
      .eq('smartcar_vehicle_id', webhookData.vehicleId)
      .eq('is_active', true)
      .single()

    if (connectionError || !connection) {
      console.log('Vehicle connection not found:', webhookData.vehicleId)
      return new Response('Vehicle not found', { 
        headers: corsHeaders,
        status: 404 
      })
    }

    // Handle different webhook types
    switch (webhookData.eventType) {
      case 'vehicle.trip.completed':
        await handleTripCompleted(supabase, connection, webhookData)
        break
      
      case 'vehicle.trip.started':
        await handleTripStarted(supabase, connection, webhookData)
        break
      
      default:
        console.log('Unhandled webhook type:', webhookData.eventType)
    }

    return new Response('OK', { 
      headers: corsHeaders,
      status: 200 
    })

  } catch (error) {
    console.error('Webhook error:', error)
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    })
  }
})

async function handleTripCompleted(supabase: any, connection: any, webhookData: SmartcarWebhookData) {
  console.log('Handling trip completed for vehicle:', connection.smartcar_vehicle_id)

  try {
    // Get trip data from Smartcar API
    const tripData = await fetchTripData(connection.access_token, connection.smartcar_vehicle_id)
    
    if (!tripData) {
      console.log('No trip data available')
      return
    }

    // Create trip record
    const { data: trip, error } = await supabase
      .from('sense_trips')
      .insert({
        user_id: connection.user_id,
        vehicle_connection_id: connection.id,
        smartcar_trip_id: webhookData.data?.tripId || crypto.randomUUID(),
        start_time: tripData.startTime || new Date().toISOString(),
        end_time: tripData.endTime || new Date().toISOString(),
        start_location: {
          lat: tripData.startLocation?.latitude || 0,
          lng: tripData.startLocation?.longitude || 0,
          address: tripData.startLocation?.address || 'Unknown'
        },
        end_location: {
          lat: tripData.endLocation?.latitude || 0,
          lng: tripData.endLocation?.longitude || 0,
          address: tripData.endLocation?.address || 'Unknown'
        },
        distance_km: tripData.distance || 0,
        duration_minutes: tripData.duration || 0,
        fuel_consumed_liters: tripData.fuelConsumed || null,
        odometer_km: tripData.odometer || null,
        trip_status: 'completed',
        trip_type: 'unknown', // Will need manual categorization
        is_automatic: true,
        route_data: tripData.route || null
      })
      .select()
      .single()

    if (error) {
      console.error('Failed to create trip:', error)
      throw error
    }

    console.log('Created automatic trip:', trip.id)

  } catch (error) {
    console.error('Error handling trip completed:', error)
  }
}

async function handleTripStarted(supabase: any, connection: any, webhookData: SmartcarWebhookData) {
  console.log('Handling trip started for vehicle:', connection.smartcar_vehicle_id)
  
  // Could create an active trip record here if needed
  // For now, we'll wait for trip completion
}

async function fetchTripData(accessToken: string, vehicleId: string) {
  try {
    // Get current location
    const locationResponse = await fetch(`https://api.smartcar.com/v2.0/vehicles/${vehicleId}/location`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    })

    // Get odometer
    const odometerResponse = await fetch(`https://api.smartcar.com/v2.0/vehicles/${vehicleId}/odometer`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    })

    // Get fuel level
    const fuelResponse = await fetch(`https://api.smartcar.com/v2.0/vehicles/${vehicleId}/fuel`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    })

    const location = locationResponse.ok ? await locationResponse.json() : null
    const odometer = odometerResponse.ok ? await odometerResponse.json() : null
    const fuel = fuelResponse.ok ? await fuelResponse.json() : null

    return {
      endLocation: location ? {
        latitude: location.latitude,
        longitude: location.longitude,
        address: 'Unknown' // Would need geocoding
      } : null,
      odometer: odometer?.distance,
      fuelLevel: fuel?.percent,
      // Note: Smartcar doesn't provide trip-specific data like start/end times
      // This would need to be tracked differently or use a different service
    }

  } catch (error) {
    console.error('Error fetching trip data:', error)
    return null
  }
}
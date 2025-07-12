const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface VehicleDataRequest {
  vehicleId: string
  accessToken: string
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
    const { vehicleId, accessToken }: VehicleDataRequest = await req.json()
    
    console.log('Fetching data for vehicle:', vehicleId)

    // Fetch multiple data points concurrently
    const [locationRes, odometerRes, fuelRes, infoRes] = await Promise.all([
      fetch(`https://api.smartcar.com/v2.0/vehicles/${vehicleId}/location`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      }).catch(e => ({ ok: false, error: e.message })),
      
      fetch(`https://api.smartcar.com/v2.0/vehicles/${vehicleId}/odometer`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      }).catch(e => ({ ok: false, error: e.message })),
      
      fetch(`https://api.smartcar.com/v2.0/vehicles/${vehicleId}/fuel`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      }).catch(e => ({ ok: false, error: e.message })),
      
      fetch(`https://api.smartcar.com/v2.0/vehicles/${vehicleId}`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      }).catch(e => ({ ok: false, error: e.message }))
    ])

    const data: any = {
      timestamp: new Date().toISOString(),
      vehicleId
    }

    // Parse responses
    if (locationRes.ok) {
      const location = await locationRes.json()
      data.location = {
        latitude: location.latitude,
        longitude: location.longitude,
        timestamp: location.age || new Date().toISOString()
      }
      console.log('Location:', data.location)
    } else {
      console.log('Location fetch failed:', locationRes.error || 'Unknown error')
    }

    if (odometerRes.ok) {
      const odometer = await odometerRes.json()
      data.odometer = {
        distance: odometer.distance,
        unit: odometer.unit || 'km',
        timestamp: odometer.age || new Date().toISOString()
      }
      console.log('Odometer:', data.odometer)
    } else {
      console.log('Odometer fetch failed:', odometerRes.error || 'Unknown error')
    }

    if (fuelRes.ok) {
      const fuel = await fuelRes.json()
      data.fuel = {
        percent: fuel.percent,
        range: fuel.range,
        unit: fuel.unit || 'km',
        timestamp: fuel.age || new Date().toISOString()
      }
      console.log('Fuel:', data.fuel)
    } else {
      console.log('Fuel fetch failed:', fuelRes.error || 'Unknown error')
    }

    if (infoRes.ok) {
      const info = await infoRes.json()
      data.info = {
        id: info.id,
        make: info.make,
        model: info.model,
        year: info.year
      }
      console.log('Vehicle info:', data.info)
    } else {
      console.log('Info fetch failed:', infoRes.error || 'Unknown error')
    }

    return new Response(JSON.stringify({
      success: true,
      data,
      dataPoints: Object.keys(data).filter(key => key !== 'timestamp' && key !== 'vehicleId').length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    })

  } catch (error) {
    console.error('Vehicle data fetch error:', error)
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    })
  }
})
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface TestTripRequest {
  user_id: string
  trip_type?: 'work' | 'personal' | 'random'
  count?: number
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    if (req.method === 'POST') {
      const { user_id, trip_type = 'random', count = 1 }: TestTripRequest = await req.json()

      console.log(`Generating ${count} test trips for user ${user_id}`)

      const trips = []
      for (let i = 0; i < count; i++) {
        const trip = await generateTestTrip(supabase, user_id, trip_type)
        if (trip) trips.push(trip)
      }

      return new Response(JSON.stringify({ 
        success: true, 
        trips: trips.length,
        generated: trips
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      })
    }

    if (req.method === 'GET') {
      // Return available test scenarios
      return new Response(JSON.stringify({
        scenarios: [
          { type: 'work', description: 'Arbetsresor - pendling till kontoret' },
          { type: 'personal', description: 'Privata resor - handel, vänner, fritid' },
          { type: 'random', description: 'Slumpmässiga resor av olika typer' }
        ],
        locations: getTestLocations()
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      })
    }

    return new Response('Method not allowed', { 
      headers: corsHeaders,
      status: 405 
    })

  } catch (error) {
    console.error('Test generator error:', error)
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    })
  }
})

async function generateTestTrip(supabase: any, userId: string, tripType: string) {
  const locations = getTestLocations()
  const scenarios = getTripScenarios()
  
  // Select scenario based on trip type
  let scenario
  if (tripType === 'random') {
    scenario = scenarios[Math.floor(Math.random() * scenarios.length)]
  } else {
    const filtered = scenarios.filter(s => s.type === tripType)
    scenario = filtered[Math.floor(Math.random() * filtered.length)]
  }

  const startLocation = locations[Math.floor(Math.random() * locations.length)]
  const endLocation = locations[Math.floor(Math.random() * locations.length)]
  
  // Generate realistic trip data
  const distance = calculateDistance(startLocation, endLocation)
  const duration = Math.round(distance / 45 + Math.random() * 20) // ~45 km/h average + random
  const fuelConsumed = Math.round((distance * 0.08 + Math.random() * 0.02) * 100) / 100 // ~8L/100km
  
  // Generate timestamps (within last 30 days)
  const daysAgo = Math.floor(Math.random() * 30)
  const startTime = new Date()
  startTime.setDate(startTime.getDate() - daysAgo)
  startTime.setHours(scenario.startHour + Math.floor(Math.random() * 3))
  startTime.setMinutes(Math.floor(Math.random() * 60))
  
  const endTime = new Date(startTime)
  endTime.setMinutes(endTime.getMinutes() + duration)

  // Create trip record
  const { data: trip, error } = await supabase
    .from('sense_trips')
    .insert({
      user_id: userId,
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
      start_location: {
        lat: startLocation.lat,
        lng: startLocation.lng,
        address: startLocation.address
      },
      end_location: {
        lat: endLocation.lat,
        lng: endLocation.lng,
        address: endLocation.address
      },
      distance_km: distance,
      duration_minutes: duration,
      fuel_consumed_liters: fuelConsumed,
      trip_status: 'completed',
      trip_type: scenario.type,
      is_automatic: true,
      notes: scenario.note || null,
      route_data: generateRouteData(startLocation, endLocation)
    })
    .select()
    .single()

  if (error) {
    console.error('Failed to create test trip:', error)
    return null
  }

  console.log(`Created test trip: ${trip.id} (${scenario.type})`)
  return trip
}

function getTestLocations() {
  return [
    { lat: 59.3293, lng: 18.0686, address: "Stockholm Centralstation" },
    { lat: 59.3345, lng: 18.0632, address: "Gamla Stan, Stockholm" },
    { lat: 59.3426, lng: 18.0611, address: "Östermalm, Stockholm" },
    { lat: 59.3157, lng: 18.0884, address: "Södermalm, Stockholm" },
    { lat: 59.2741, lng: 18.0199, address: "Bromma, Stockholm" },
    { lat: 59.4372, lng: 17.9548, address: "Sollentuna" },
    { lat: 59.2794, lng: 17.8395, address: "Södertälje" },
    { lat: 59.4020, lng: 17.9441, address: "Solna" },
    { lat: 59.3584, lng: 17.9424, address: "Kista, Stockholm" },
    { lat: 59.2753, lng: 18.1203, address: "Nacka" },
    { lat: 59.3793, lng: 17.8134, address: "ICA Maxi Vällingby" },
    { lat: 59.3488, lng: 18.0704, address: "Arlanda Express Cityterminalen" }
  ]
}

function getTripScenarios() {
  return [
    { 
      type: 'work', 
      startHour: 7, 
      note: 'Morgonpendling till jobbet',
      description: 'Daglig pendling'
    },
    { 
      type: 'work', 
      startHour: 16, 
      note: 'Hemresa från jobbet',
      description: 'Hemkörning efter arbetsdag'
    },
    { 
      type: 'work', 
      startHour: 9, 
      note: 'Kundbesök',
      description: 'Affärsresa'
    },
    { 
      type: 'personal', 
      startHour: 10, 
      note: 'Handla mat på ICA',
      description: 'Matinköp'
    },
    { 
      type: 'personal', 
      startHour: 14, 
      note: 'Besök hos vänner',
      description: 'Socialt besök'
    },
    { 
      type: 'personal', 
      startHour: 18, 
      note: 'Middag på restaurang',
      description: 'Restaurangbesök'
    },
    { 
      type: 'personal', 
      startHour: 11, 
      note: 'Läkarbesök',
      description: 'Vårdbesök'
    },
    { 
      type: 'personal', 
      startHour: 15, 
      note: 'Träning på gymmet',
      description: 'Fritidsaktivitet'
    }
  ]
}

function calculateDistance(start: any, end: any) {
  // Simple distance calculation (not perfectly accurate but good for testing)
  const R = 6371 // Earth's radius in km
  const dLat = (end.lat - start.lat) * Math.PI / 180
  const dLng = (end.lng - start.lng) * Math.PI / 180
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(start.lat * Math.PI / 180) * Math.cos(end.lat * Math.PI / 180) *
    Math.sin(dLng/2) * Math.sin(dLng/2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
  return Math.round(R * c * 10) / 10 // Round to 1 decimal
}

function generateRouteData(start: any, end: any) {
  // Generate a simple route with a few waypoints
  const waypoints = []
  const steps = 5
  
  for (let i = 0; i <= steps; i++) {
    const progress = i / steps
    const lat = start.lat + (end.lat - start.lat) * progress
    const lng = start.lng + (end.lng - start.lng) * progress
    
    // Add some randomness to make it look more realistic
    const randomLat = lat + (Math.random() - 0.5) * 0.01
    const randomLng = lng + (Math.random() - 0.5) * 0.01
    
    waypoints.push({
      lat: randomLat,
      lng: randomLng,
      timestamp: new Date(Date.now() + i * 60000).toISOString() // 1 minute intervals
    })
  }
  
  return { waypoints }
}
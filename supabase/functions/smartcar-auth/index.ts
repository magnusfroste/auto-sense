import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SmartcarAuthRequest {
  code: string
  user_id: string
  test?: boolean
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const smartcarClientId = Deno.env.get('SMARTCAR_CLIENT_ID')!
    const smartcarClientSecret = Deno.env.get('SMARTCAR_CLIENT_SECRET')!

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    if (req.method === 'GET') {
      // Get test mode from query params
      const url = new URL(req.url)
      const testMode = url.searchParams.get('test') === 'true'
      
      console.log('GET request for OAuth URL, test mode:', testMode)
      
      // Return OAuth URL for frontend
      const state = crypto.randomUUID()
      const redirectUri = `${supabaseUrl}/functions/v1/smartcar-auth-callback`
      
      const mode = testMode ? 'test' : 'live'
      const oauthUrl = `https://connect.smartcar.com/oauth/authorize?` +
        `response_type=code&` +
        `client_id=${smartcarClientId}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `scope=read_vehicle_info read_location read_odometer read_fuel&` +
        `state=${state}&` +
        `mode=${mode}`

      console.log('Generated OAuth URL with mode:', mode)

      return new Response(JSON.stringify({ 
        oauth_url: oauthUrl,
        state,
        test_mode: testMode
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      })
    }

    if (req.method === 'POST') {
      const { code, user_id }: SmartcarAuthRequest = await req.json()

      console.log('Exchanging code for token for user:', user_id)

      // Exchange code for access token
      const tokenResponse = await fetch('https://auth.smartcar.com/oauth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${btoa(`${smartcarClientId}:${smartcarClientSecret}`)}`
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: `${supabaseUrl}/functions/v1/smartcar-auth-callback`
        })
      })

      if (!tokenResponse.ok) {
        const error = await tokenResponse.text()
        console.error('Token exchange failed:', error)
        throw new Error('Failed to exchange code for token')
      }

      const tokenData = await tokenResponse.json()
      console.log('Token exchange successful')

      // Get vehicles list - using v1.0 API as per Smartcar tutorial
      const vehiclesResponse = await fetch('https://api.smartcar.com/v1.0/vehicles', {
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`
        }
      })

      if (!vehiclesResponse.ok) {
        const vehiclesError = await vehiclesResponse.text()
        console.error('Get vehicles failed:', vehiclesResponse.status, vehiclesError)
        throw new Error(`Failed to get vehicles: ${vehiclesResponse.status} ${vehiclesError}`)
      }

      const vehiclesData = await vehiclesResponse.json()
      console.log('Found vehicles:', vehiclesData.vehicles?.length || 0)

      // Store each vehicle connection
      const connections = []
      for (const vehicleId of vehiclesData.vehicles || []) {
        console.log('Processing vehicle:', vehicleId)
        
        // Get vehicle info - using v1.0 API as per Smartcar tutorial
        const infoResponse = await fetch(`https://api.smartcar.com/v1.0/vehicles/${vehicleId}`, {
          headers: {
            'Authorization': `Bearer ${tokenData.access_token}`
          }
        })

        let vehicleInfo = {}
        if (infoResponse.ok) {
          vehicleInfo = await infoResponse.json()
          console.log('Vehicle info retrieved:', vehicleInfo)
        } else {
          const infoError = await infoResponse.text()
          console.error('Get vehicle info failed:', infoResponse.status, infoError)
          // Continue with empty info rather than failing completely
        }

        // Store vehicle connection
        const { data: connection, error } = await supabase
          .from('vehicle_connections')
          .insert({
            user_id: user_id,
            vehicle_id: vehicleId,
            smartcar_vehicle_id: vehicleId,
            make: vehicleInfo.make,
            model: vehicleInfo.model,
            year: vehicleInfo.year,
            vin: vehicleInfo.vin,
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token,
            is_active: true
          })
          .select()
          .single()

        if (error) {
          console.error('Failed to store vehicle connection:', error)
          throw error
        }

        connections.push(connection)
      }

      console.log('Stored', connections.length, 'vehicle connections')

      return new Response(JSON.stringify({ 
        success: true, 
        connections: connections.length 
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
    console.error('Smartcar auth error:', error)
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400
    })
  }
})
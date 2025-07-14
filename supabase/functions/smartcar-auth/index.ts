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

  console.log('Request received:', {
    method: req.method,
    url: req.url,
    headers: Object.fromEntries(req.headers.entries())
  });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const smartcarClientId = Deno.env.get('SMARTCAR_CLIENT_ID')!
    const smartcarClientSecret = Deno.env.get('SMARTCAR_CLIENT_SECRET')!
    const siteUrl = Deno.env.get('SITE_URL') // Should be https://sense.froste.eu
    
    console.log('🔧 Environment check:', {
      hasSupabaseUrl: !!supabaseUrl,
      hasServiceKey: !!supabaseServiceKey,
      hasSmartcarClient: !!smartcarClientId,
      hasSmartcarSecret: !!smartcarClientSecret,
      siteUrl,
      supabaseUrl: supabaseUrl?.substring(0, 30) + '...'
    })

    if (!smartcarClientId || !smartcarClientSecret) {
      console.error('Missing Smartcar credentials');
      throw new Error('Smartcar credentials not configured');
    }

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
      const body = await req.json();
      console.log('POST request body:', { ...body, code: body.code?.substring(0, 10) + '...' });
      
      const { code, user_id, test }: SmartcarAuthRequest = body;

      if (!code || !user_id) {
        console.error('Missing required parameters:', { hasCode: !!code, hasUserId: !!user_id });
        throw new Error('Missing code or user_id');
      }

      console.log('Exchanging code for token for user:', user_id, 'test mode:', test)

      // Exchange code for access token
      console.log('🔄 Exchanging code for tokens...');
      const redirectUri = `${supabaseUrl}/functions/v1/smartcar-auth-callback`
      console.log('📍 Using redirect_uri:', redirectUri)
      
      const tokenResponse = await fetch('https://auth.smartcar.com/oauth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${btoa(`${smartcarClientId}:${smartcarClientSecret}`)}`
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: redirectUri
        })
      })

      if (!tokenResponse.ok) {
        const tokenError = await tokenResponse.text();
        console.error('Token exchange failed:', tokenResponse.status, tokenError);
        throw new Error(`Failed to exchange code for tokens: ${tokenResponse.status} ${tokenError}`)
      }

      const tokenData = await tokenResponse.json()
      console.log('✅ Token exchange successful:', {
        hasAccessToken: !!tokenData.access_token,
        hasRefreshToken: !!tokenData.refresh_token,
        accessTokenLength: tokenData.access_token?.length,
        expiresIn: tokenData.expires_in
      })

      // Get vehicles list - using v1.0 API as per Smartcar tutorial
      console.log('🚗 Fetching vehicles list...')
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
      console.log('✅ Found vehicles:', {
        count: vehiclesData.vehicles?.length || 0,
        vehicles: vehiclesData.vehicles
      })

      // Store each vehicle connection
      const connections = []
      for (const vehicleId of vehiclesData.vehicles || []) {
        console.log('🔧 Processing vehicle:', vehicleId)
        
        // Get vehicle info - using v1.0 API as per Smartcar tutorial
        const infoResponse = await fetch(`https://api.smartcar.com/v1.0/vehicles/${vehicleId}`, {
          headers: {
            'Authorization': `Bearer ${tokenData.access_token}`
          }
        })

        let vehicleInfo = {}
        if (infoResponse.ok) {
          vehicleInfo = await infoResponse.json()
          console.log('✅ Vehicle info retrieved:', {
            vehicleId,
            make: vehicleInfo.make,
            model: vehicleInfo.model,
            year: vehicleInfo.year,
            vin: vehicleInfo.vin?.substring(0, 8) + '...'
          })
        } else {
          const infoError = await infoResponse.text()
          console.error('❌ Get vehicle info failed:', {
            vehicleId,
            status: infoResponse.status,
            error: infoError
          })
          // Continue with empty info rather than failing completely
        }

        // Store vehicle connection
        console.log('💾 Storing vehicle connection for:', vehicleId)
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
          console.error('❌ Failed to store vehicle connection:', {
            vehicleId,
            error: error.message,
            code: error.code,
            details: error.details,
            hint: error.hint
          })
          throw new Error(`Database error storing vehicle ${vehicleId}: ${error.message}`)
        }

        console.log('✅ Vehicle connection stored:', {
          connectionId: connection.id,
          vehicleId,
          userId: user_id
        })
        connections.push(connection)
      }

      console.log(`🎉 Successfully stored ${connections.length} vehicle connections for user:`, user_id);

      return new Response(JSON.stringify({ 
        success: true, 
        connections_stored: connections.length,
        test_mode: test,
        timestamp: new Date().toISOString()
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
    console.error('🚨 Smartcar auth error:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      cause: error.cause
    })

    // Determine appropriate HTTP status code
    let statusCode = 500 // Default to server error
    let errorMessage = error.message

    // Client errors (4xx)
    if (error.message.includes('Missing') || 
        error.message.includes('Invalid') ||
        error.message.includes('code or user_id')) {
      statusCode = 400
    }
    // Authentication/authorization errors
    else if (error.message.includes('Failed to exchange code') ||
             error.message.includes('credentials not configured')) {
      statusCode = 401
    }
    // Smartcar API errors
    else if (error.message.includes('Failed to get vehicles')) {
      statusCode = 502 // Bad Gateway - external service error
    }

    return new Response(JSON.stringify({ 
      error: errorMessage,
      status: statusCode,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: statusCode
    })
  }
})
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'GET') {
    return new Response('Method not allowed', { 
      headers: corsHeaders,
      status: 405 
    })
  }

  try {
    const url = new URL(req.url)
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')
    const error = url.searchParams.get('error')

    console.log('OAuth callback received:', { code: code?.substring(0, 10) + '...', state, error })

    if (error) {
      console.error('OAuth error:', error)
      const errorUrl = new URL('https://37ba7bea-4e4a-40da-b001-982449075670.lovableproject.com/smartcar-test')
      errorUrl.searchParams.set('oauth_error', error)
      return Response.redirect(errorUrl.toString())
    }

    if (!code || !state) {
      console.error('Missing required parameters:', { hasCode: !!code, hasState: !!state })
      const errorUrl = new URL('https://37ba7bea-4e4a-40da-b001-982449075670.lovableproject.com/smartcar-test')
      errorUrl.searchParams.set('oauth_error', 'Missing required parameters')
      return Response.redirect(errorUrl.toString())
    }

    // Redirect back to test page with OAuth success parameters
    console.log('Redirecting to test page with OAuth success')
    const successUrl = new URL('https://37ba7bea-4e4a-40da-b001-982449075670.lovableproject.com/smartcar-test')
    successUrl.searchParams.set('oauth_success', 'true')
    successUrl.searchParams.set('code', code)
    successUrl.searchParams.set('state', state)
    
    return Response.redirect(successUrl.toString())

  } catch (error) {
    console.error('Callback error:', error)
    const errorUrl = new URL('https://37ba7bea-4e4a-40da-b001-982449075670.lovableproject.com/smartcar-test')
    errorUrl.searchParams.set('oauth_error', error.message)
    return Response.redirect(errorUrl.toString())
  }
})
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.5'

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

    // Always use SITE_URL for consistent origin handling
    const origin = Deno.env.get('SITE_URL') || 
                  'https://37ba7bea-4e4a-40da-b001-982449075670.lovableproject.com'

    if (error) {
      console.error('OAuth error:', error)
      const errorUrl = new URL(`${origin}/settings`)
      errorUrl.searchParams.set('oauth_error', error)
      return Response.redirect(errorUrl.toString())
    }

    if (!code || !state) {
      console.error('Missing required parameters:', { hasCode: !!code, hasState: !!state })
      const errorUrl = new URL(`${origin}/settings`)
      errorUrl.searchParams.set('oauth_error', 'Missing required parameters')
      return Response.redirect(errorUrl.toString())
    }

    // Always redirect to settings page with OAuth success data
    console.log('Redirecting to settings page with OAuth success');
    const successUrl = new URL(`${origin}/settings`)
    successUrl.searchParams.set('oauth_success', 'true')
    successUrl.searchParams.set('code', code)
    successUrl.searchParams.set('state', state)
    successUrl.searchParams.set('auto_start', 'true')
    
    return Response.redirect(successUrl.toString())

  } catch (error) {
    console.error('Callback error:', error)
    // Use SITE_URL for consistent origin handling
    const origin = Deno.env.get('SITE_URL') || 
                  'https://37ba7bea-4e4a-40da-b001-982449075670.lovableproject.com'
    const errorUrl = new URL(`${origin}/settings`)
    errorUrl.searchParams.set('oauth_error', error.message)
    return Response.redirect(errorUrl.toString())
  }
})
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

    // After successful OAuth, we need to check if vehicle connection was successful
    // and automatically start polling if it was. The actual vehicle connection
    // logic happens in the frontend, so we'll redirect back with success params
    // and let the frontend handle the automatic activation
    
    // Return HTML that handles both popup and redirect scenarios
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>OAuth Success</title>
        </head>
        <body>
          <script>
            if (window.opener) {
              // This is a popup, send message to parent
              console.log('Sending message to parent window');
              window.opener.postMessage({
                type: 'oauth_success',
                code: '${code}',
                state: '${state}'
              }, '${origin}');
              window.close();
            } else {
              // This is a redirect, go to settings page
              console.log('Redirecting to settings page');
              window.location.href = '${origin}/settings?oauth_success=true&code=${code}&state=${state}&auto_start=true';
            }
          </script>
          <p>Processing OAuth response...</p>
        </body>
      </html>
    `;

    return new Response(html, {
      headers: { ...corsHeaders, 'Content-Type': 'text/html' }
    })

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
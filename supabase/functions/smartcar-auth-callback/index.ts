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

    if (error) {
      console.error('OAuth error:', error)
      return new Response(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Anslutning misslyckades</title>
          <meta charset="utf-8">
        </head>
        <body>
          <h1>Anslutning misslyckades</h1>
          <p>Ett fel uppstod vid anslutning av ditt fordon: ${error}</p>
          <script>
            setTimeout(() => {
              window.close();
            }, 3000);
          </script>
        </body>
        </html>
      `, {
        headers: { ...corsHeaders, 'Content-Type': 'text/html' }
      })
    }

    if (!code || !state) {
      return new Response(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Ogiltiga parametrar</title>
          <meta charset="utf-8">
        </head>
        <body>
          <h1>Ogiltiga parametrar</h1>
          <p>Saknade obligatoriska parametrar för OAuth-callback.</p>
          <script>
            setTimeout(() => {
              window.close();
            }, 3000);
          </script>
        </body>
        </html>
      `, {
        headers: { ...corsHeaders, 'Content-Type': 'text/html' }
      })
    }

    // Return success page that posts message to parent window
    return new Response(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Fordon anslutet!</title>
        <meta charset="utf-8">
        <style>
          body {
            font-family: system-ui, -apple-system, sans-serif;
            text-align: center;
            padding: 2rem;
            background: #f8fafc;
          }
          .success {
            background: white;
            border-radius: 8px;
            padding: 2rem;
            max-width: 400px;
            margin: 2rem auto;
            box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
          }
          .spinner {
            border: 3px solid #f3f3f3;
            border-top: 3px solid #3b82f6;
            border-radius: 50%;
            width: 30px;
            height: 30px;
            animation: spin 1s linear infinite;
            margin: 1rem auto;
          }
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        </style>
      </head>
      <body>
        <div class="success">
          <h1>🚗 Fordon anslutet!</h1>
          <p>Ditt fordon har anslutits framgångsrikt. Du kan nu stänga detta fönster.</p>
          <div class="spinner"></div>
          <p><small>Slutför anslutning...</small></p>
        </div>
        <script>
          // Enhanced message posting with retries and confirmation
          function postOAuthMessage() {
            if (window.opener && !window.opener.closed) {
              console.log('Sending OAuth success message to parent...');
              window.opener.postMessage({
                type: 'SMARTCAR_AUTH_SUCCESS',
                code: '${code}',
                state: '${state}',
                timestamp: new Date().toISOString()
              }, '*');
              return true;
            }
            return false;
          }
          
          // Send message immediately
          let messageSent = postOAuthMessage();
          
          // Retry mechanism for message delivery
          if (!messageSent) {
            let retryCount = 0;
            const retryInterval = setInterval(() => {
              retryCount++;
              console.log('Retrying message send, attempt:', retryCount);
              
              if (postOAuthMessage() || retryCount >= 5) {
                clearInterval(retryInterval);
                console.log('Message delivery completed or max retries reached');
              }
            }, 200);
          }
          
          // Close window after longer delay to ensure message delivery
          setTimeout(() => {
            console.log('Closing OAuth popup...');
            window.close();
          }, 3000);
        </script>
      </body>
      </html>
    `, {
      headers: { ...corsHeaders, 'Content-Type': 'text/html' }
    })

  } catch (error) {
    console.error('Callback error:', error)
    return new Response(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Fel uppstod</title>
        <meta charset="utf-8">
      </head>
      <body>
        <h1>Fel uppstod</h1>
        <p>Ett oväntat fel uppstod: ${error.message}</p>
        <script>
          setTimeout(() => {
            window.close();
          }, 3000);
        </script>
      </body>
      </html>
    `, {
      headers: { ...corsHeaders, 'Content-Type': 'text/html' }
    })
  }
})
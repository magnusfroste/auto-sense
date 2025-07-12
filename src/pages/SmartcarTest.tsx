import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Car, CheckCircle, XCircle, Loader2 } from "lucide-react";

export default function SmartcarTest() {
  const [isConnecting, setIsConnecting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    data?: any;
  } | null>(null);
  const { toast } = useToast();

  // Check for OAuth results in URL parameters
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const oauthSuccess = urlParams.get('oauth_success');
    const oauthError = urlParams.get('oauth_error');
    const code = urlParams.get('code');
    const state = urlParams.get('state');

    if (oauthError) {
      setTestResult({
        success: false,
        message: `OAuth error: ${oauthError}`
      });
      // Clean URL
      window.history.replaceState({}, '', '/smartcar-test');
    } else if (oauthSuccess && code) {
      handleOAuthSuccess(code, state);
    }
  }, []);

  const handleOAuthSuccess = async (code: string, state: string | null) => {
    console.log('🎉 OAuth success detected! Processing token exchange...');
    setIsConnecting(true);
    
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('No authenticated user found');
      }

      console.log('👤 Current user:', user.id);
      console.log('🔑 Authorization code:', code?.substring(0, 10) + '...');

      // Exchange code for tokens using POST endpoint
      const { data: tokenData, error: tokenError } = await supabase.functions.invoke('smartcar-auth', {
        method: 'POST',
        body: {
          code: code,
          user_id: user.id,
          test: true
        }
      });

      if (tokenError) {
        console.error('❌ Token exchange error:', tokenError);
        setTestResult({
          success: false,
          message: `Token exchange failed: ${tokenError.message}`
        });
        return;
      }

      console.log('✅ Token exchange successful:', tokenData);
      setTestResult({
        success: true,
        message: `Vehicle connection successful! Stored ${tokenData.connections_stored} connections.`,
        data: tokenData
      });
      
      toast({
        title: "Test lyckades!",
        description: "Smartcar OAuth flow och token exchange fungerar",
      });
      
    } catch (error: any) {
      console.error('💥 Error during token exchange:', error);
      setTestResult({
        success: false,
        message: `Token exchange error: ${error.message}`
      });
    } finally {
      setIsConnecting(false);
      // Clean URL
      window.history.replaceState({}, '', '/smartcar-test');
    }
  };

  const handleTestConnection = async () => {
    console.log('🧪 Starting Smartcar test connection...');
    console.log('🖥️ Platform: Mac Chrome - Using full page redirect to avoid CSP issues');
    setIsConnecting(true);
    setTestResult(null);

    try {
      // Clear any cached content first (Mac Chrome specific)
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (let registration of registrations) {
          registration.unregister();
        }
      }

      // Call Smartcar auth edge function to get OAuth URL
      const { data, error } = await supabase.functions.invoke('smartcar-auth?test=true', {
        method: 'GET'
      });

      if (error) {
        console.error('❌ Smartcar auth error:', error);
        setTestResult({
          success: false,
          message: `Error: ${error.message}`
        });
        return;
      }

      console.log('✅ Smartcar auth response:', data);

      if (data?.oauth_url) {
        // Use direct redirect - this should NOT trigger CSP errors
        console.log('🔀 Performing FULL PAGE REDIRECT (no popup/iframe)');
        console.log('🔗 OAuth URL:', data.oauth_url);
        
        // Try multiple redirect methods to bypass any interference
        try {
          // Method 1: Replace current location
          window.location.replace(data.oauth_url);
        } catch (error) {
          console.log('Replace failed, trying assign...');
          try {
            // Method 2: Assign location
            window.location.assign(data.oauth_url);
          } catch (error2) {
            console.log('Assign failed, trying href...');
            // Method 3: Set href directly
            window.location.href = data.oauth_url;
          }
        }
        return;
      } else {
        setTestResult({
          success: false,
          message: 'Ingen oauth_url returnerad från edge function'
        });
      }

    } catch (error: any) {
      console.error('💥 Test connection error:', error);
      setTestResult({
        success: false,
        message: `Unexpected error: ${error.message}`
      });
      setIsConnecting(false);
    }
  };

  const handleTestVehicle = async () => {
    console.log('🚗 Testing with Smartcar test vehicle...');
    
    toast({
      title: "Info",
      description: "Använd Smartcar test credentials: username=demo@smartcar.com, password=password",
    });

    await handleTestConnection();
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Smartcar Test</h1>
        <p className="text-muted-foreground">
          Testa Smartcar OAuth flow isolerat från huvudapplikationen
        </p>
      </div>

      <div className="grid gap-6">
        {/* Test Controls */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Car className="h-5 w-5" />
              OAuth Test
            </CardTitle>
            <CardDescription>
              Testa Smartcar OAuth flow med test-credentials
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertDescription>
                <strong>Test Credentials:</strong><br />
                Email: demo@smartcar.com<br />
                Password: password
              </AlertDescription>
            </Alert>
            
            <div className="flex gap-3">
              <Button
                onClick={handleTestVehicle}
                disabled={isConnecting}
                className="flex items-center gap-2"
              >
                {isConnecting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Car className="h-4 w-4" />
                )}
                Testa med Smartcar Demo
              </Button>
              
              <Button
                onClick={handleTestConnection}
                disabled={isConnecting}
                variant="outline"
                className="flex items-center gap-2"
              >
                {isConnecting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Car className="h-4 w-4" />
                )}
                Allmän OAuth Test
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Test Results */}
        {testResult && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {testResult.success ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-500" />
                )}
                Test Resultat
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge variant={testResult.success ? "default" : "destructive"}>
                    {testResult.success ? "LYCKADES" : "MISSLYCKADES"}
                  </Badge>
                </div>
                
                <p className="text-sm">{testResult.message}</p>
                
                {testResult.data && (
                  <details className="mt-4">
                    <summary className="cursor-pointer text-sm font-medium">
                      Visa rådata
                    </summary>
                    <pre className="mt-2 text-xs bg-muted p-3 rounded overflow-auto">
                      {JSON.stringify(testResult.data, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Debug Info */}
        <Card>
          <CardHeader>
            <CardTitle>Debug Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <p><strong>Current URL:</strong> {window.location.href}</p>
              <p><strong>User Agent:</strong> {navigator.userAgent}</p>
              <p><strong>Popup Support:</strong> {window.open ? "✅ Ja" : "❌ Nej"}</p>
              <p><strong>PostMessage Support:</strong> {window.postMessage ? "✅ Ja" : "❌ Nej"}</p>
            </div>
            
            <Alert className="mt-4">
              <AlertDescription>
                Öppna Developer Console (F12) för detaljerade loggar under testet.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
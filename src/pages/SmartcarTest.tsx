import { useState } from "react";
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

  const handleTestConnection = async () => {
    console.log('🧪 Starting Smartcar test connection...');
    setIsConnecting(true);
    setTestResult(null);

    try {
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
        // Open popup window for OAuth
        console.log('🪟 Opening popup for OAuth...');
        const popup = window.open(
          data.oauth_url,
          'smartcar-oauth',
          'width=600,height=700,scrollbars=yes,resizable=yes,toolbar=no,menubar=no,location=no,status=no'
        );

        if (!popup) {
          setTestResult({
            success: false,
            message: 'Popup blockerat av webbläsaren'
          });
          return;
        }

        // Listen for OAuth completion - more permissive filtering
        const handleMessage = async (event: MessageEvent) => {
          // Log ALL messages for debugging
          console.log('📨 Received message from:', event.origin, 'data:', event.data);

          // Accept messages from any origin for testing (more permissive)
          if (!event.data || typeof event.data !== 'object') {
            console.log('🚫 Ignoring non-object message');
            return;
          }

          // Filter out known irrelevant messages
          if (event.data.target === 'metamask-inpage' || 
              event.data.type === 'webpackWarnings' ||
              event.data.type === 'webpackErrors') {
            return;
          }

          console.log('📨 Processing message:', event.data);

          if (event.data?.type === 'SMARTCAR_AUTH_SUCCESS') {
            console.log('🎉 OAuth success detected! Code:', event.data.code?.substring(0, 10) + '...');
            
            try {
              // Get current user
              const { data: { user } } = await supabase.auth.getUser();
              if (!user) {
                throw new Error('No authenticated user found');
              }

              console.log('👤 Current user:', user.id);

              // Exchange code for tokens using POST endpoint
              const { data: tokenData, error: tokenError } = await supabase.functions.invoke('smartcar-auth', {
                method: 'POST',
                body: {
                  code: event.data.code,
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
              
            } catch (error: any) {
              console.error('💥 Error during token exchange:', error);
              setTestResult({
                success: false,
                message: `Token exchange error: ${error.message}`
              });
            }
            
            window.removeEventListener('message', handleMessage);
            
            toast({
              title: "Test lyckades!",
              description: "Smartcar OAuth flow och token exchange fungerar",
            });
          }
        };

        window.addEventListener('message', handleMessage);

        // Enhanced popup monitoring
        let popupCheckInterval: NodeJS.Timeout;
        const checkPopup = () => {
          if (popup?.closed) {
            console.log('🪟 Popup stängd');
            clearInterval(popupCheckInterval);
            window.removeEventListener('message', handleMessage);
            if (!testResult) {
              setTestResult({
                success: false,
                message: 'Popup stängd utan att OAuth slutfördes'
              });
            }
            setIsConnecting(false);
          } else {
            console.log('🪟 Popup fortfarande öppen...');
          }
        };
        
        // Check popup status every 2 seconds
        popupCheckInterval = setInterval(checkPopup, 2000);
        
        // Also set a timeout as fallback
        setTimeout(() => {
          if (popupCheckInterval) {
            clearInterval(popupCheckInterval);
          }
          setIsConnecting(false);
        }, 60000); // 60 second timeout

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
    } finally {
      setTimeout(() => setIsConnecting(false), 5000); // Timeout after 5 seconds
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
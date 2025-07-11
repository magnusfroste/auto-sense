import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useVehicleConnections } from "@/hooks/useVehicleConnections";
import { Car, TestTube, Zap, Database, Plus, Key } from "lucide-react";

export function DeveloperSection() {
  const [testMode, setTestMode] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [tripType, setTripType] = useState<'work' | 'personal' | 'random'>('random');
  const [tripCount, setTripCount] = useState('5');
  const [testEmail, setTestEmail] = useState('');
  const [testPassword, setTestPassword] = useState('');
  const [connecting, setConnecting] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const { connectVehicle } = useVehicleConnections();

  const generateTestTrips = async () => {
    if (!user) return;

    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('smartcar-test-generator', {
        body: {
          user_id: user.id,
          trip_type: tripType,
          count: parseInt(tripCount)
        }
      });

      if (error) throw error;

      toast({
        title: "Testresor genererade!",
        description: `${data.trips} nya testresor har skapats`
      });

    } catch (error: any) {
      console.error('Error generating test trips:', error);
      toast({
        title: "Fel",
        description: "Kunde inte generera testresor",
        variant: "destructive"
      });
    } finally {
      setGenerating(false);
    }
  };

  const connectTestVehicle = async () => {
    if (!testEmail.trim() || !testPassword.trim()) {
      toast({
        title: "Fyll i credentials",
        description: "Både e-post och lösenord krävs för testfordonet",
        variant: "destructive"
      });
      return;
    }

    setConnecting(true);
    try {
      // Store test credentials temporarily for the OAuth flow
      sessionStorage.setItem('smartcar_test_email', testEmail);
      sessionStorage.setItem('smartcar_test_password', testPassword);
      
      await connectVehicle(true);
      
      toast({
        title: "OAuth-flöde startat",
        description: `Använd ${testEmail} för att logga in i Smartcar testmiljön`
      });
      
    } catch (error: any) {
      console.error('Error connecting test vehicle:', error);
      toast({
        title: "Fel",
        description: "Kunde inte starta testfordonsanslutning",
        variant: "destructive"
      });
    } finally {
      setConnecting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TestTube className="h-5 w-5" />
            Utvecklarverktyg
          </CardTitle>
          <CardDescription>
            Verktyg för att testa och utveckla köjournalsfunktioner
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Test Mode Toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="test-mode">Testläge</Label>
              <div className="text-sm text-muted-foreground">
                Använd Smartcar testmiljö istället för riktiga fordon
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch 
                id="test-mode"
                checked={testMode}
                onCheckedChange={setTestMode}
              />
              <Badge variant={testMode ? "secondary" : "outline"}>
                {testMode ? "TEST" : "LIVE"}
              </Badge>
            </div>
          </div>

          {/* Smartcar Test Vehicle Connection */}
          {testMode && (
            <div className="space-y-4 pt-4 border-t">
              <div className="flex items-center gap-2">
                <Key className="h-4 w-4" />
                <Label className="text-sm font-medium">Smartcar testfordon credentials</Label>
              </div>
              
              <div className="p-4 bg-muted/50 rounded-lg space-y-4">
                <div className="text-sm text-muted-foreground">
                  Ange e-post och lösenord för det Smartcar testfordon du vill ansluta:
                </div>
                
                <div className="grid grid-cols-1 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="test-email">E-post</Label>
                    <Input
                      id="test-email"
                      type="email"
                      placeholder="exempel@simulated.com"
                      value={testEmail}
                      onChange={(e) => setTestEmail(e.target.value)}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="test-password">Lösenord</Label>
                    <Input
                      id="test-password"
                      type="password"
                      placeholder="Testfordonets lösenord"
                      value={testPassword}
                      onChange={(e) => setTestPassword(e.target.value)}
                    />
                  </div>
                </div>
                
                <Button 
                  onClick={connectTestVehicle}
                  disabled={connecting || !testEmail.trim() || !testPassword.trim()}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {connecting ? "Ansluter..." : "Anslut testfordon"}
                </Button>
                
                <div className="text-xs text-muted-foreground">
                  <strong>Tips:</strong> Du hittar testfordon credentials i din Smartcar dashboard under "Test Vehicles"
                </div>
              </div>
            </div>
          )}

          {/* Test Trip Generator */}
          <div className="space-y-4 pt-4 border-t">
            <div className="flex items-center gap-2">
              <Car className="h-4 w-4" />
              <Label className="text-sm font-medium">Generera testresor</Label>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="trip-type">Typ av resa</Label>
                <Select value={tripType} onValueChange={(value: any) => setTripType(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="random">Slumpmässig</SelectItem>
                    <SelectItem value="work">Arbetsresor</SelectItem>
                    <SelectItem value="personal">Privata resor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="trip-count">Antal resor</Label>
                <Select value={tripCount} onValueChange={setTripCount}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 resa</SelectItem>
                    <SelectItem value="5">5 resor</SelectItem>
                    <SelectItem value="10">10 resor</SelectItem>
                    <SelectItem value="20">20 resor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button 
              onClick={generateTestTrips}
              disabled={generating}
              className="w-full"
            >
              <Zap className="h-4 w-4 mr-2" />
              {generating ? "Genererar..." : "Generera testresor"}
            </Button>
          </div>

          {/* Debug Info */}
          <div className="space-y-4 pt-4 border-t">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4" />
              <Label className="text-sm font-medium">Debug-information</Label>
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">User ID:</span>
                <div className="font-mono text-xs truncate">{user?.id}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Miljö:</span>
                <div className="font-mono text-xs">
                  {window.location.hostname === 'localhost' ? 'Development' : 'Production'}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Testscenarier</CardTitle>
          <CardDescription>
            Fördefinierade testscenarier för olika användningsfall
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
              <div>
                <div className="font-medium">Veckorutiner</div>
                <div className="text-sm text-muted-foreground">
                  Genererar en typisk arbetsvecka med pendling
                </div>
              </div>
              <Button variant="outline" size="sm">
                Kommande
              </Button>
            </div>
            
            <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
              <div>
                <div className="font-medium">Semesterresa</div>
                <div className="text-sm text-muted-foreground">
                  Simulerar en längre resa med flera stopp
                </div>
              </div>
              <Button variant="outline" size="sm">
                Kommande
              </Button>
            </div>
            
            <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
              <div>
                <div className="font-medium">Affärsresa</div>
                <div className="text-sm text-muted-foreground">
                  Flera korta resor för kundbesök
                </div>
              </div>
              <Button variant="outline" size="sm">
                Kommande
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
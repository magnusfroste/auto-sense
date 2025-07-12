import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { TestTube, Zap, Database } from "lucide-react";

export function DeveloperSection() {
  const [generating, setGenerating] = useState(false);
  const [tripType, setTripType] = useState<'work' | 'personal' | 'random'>('random');
  const [tripCount, setTripCount] = useState('5');
  const { user } = useAuth();
  const { toast } = useToast();

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
          <div className="space-y-4 pt-4 border-t">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4" />
              <Label className="text-sm font-medium">Generera testdata</Label>
            </div>
            
            <div className="p-4 bg-muted/50 rounded-lg space-y-4">
              <div className="text-sm text-muted-foreground">
                Generera realistiska testresor för utveckling och testning:
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
              
              <div className="text-xs text-muted-foreground">
                Skapar realistiska resor med GPS-data, bränslekonsumtion och kategorisering
              </div>
            </div>
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
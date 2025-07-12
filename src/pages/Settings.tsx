import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Settings as SettingsIcon, User, Car, Palette, Code } from 'lucide-react';
import { VehicleConnectionSection } from '@/components/vehicle/VehicleConnectionSection';
import { ThemeSelector } from '@/components/settings/ThemeSelector';
import { DeveloperSection } from '@/components/settings/DeveloperSection';
import { TrackingModeSelector } from '@/components/settings/TrackingModeSelector';

export default function Settings() {
  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center space-x-2">
          <SettingsIcon className="h-8 w-8" />
          <span>Inställningar</span>
        </h1>
        <p className="text-muted-foreground">Hantera ditt konto och dina inställningar</p>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="profile" className="flex items-center space-x-2">
            <User className="h-4 w-4" />
            <span>Profil</span>
          </TabsTrigger>
          <TabsTrigger value="appearance" className="flex items-center space-x-2">
            <Palette className="h-4 w-4" />
            <span>Utseende</span>
          </TabsTrigger>
          <TabsTrigger value="vehicles" className="flex items-center space-x-2">
            <Car className="h-4 w-4" />
            <span>Fordon</span>
          </TabsTrigger>
          <TabsTrigger value="developer" className="flex items-center space-x-2">
            <Code className="h-4 w-4" />
            <span>Utvecklare</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Profilinställningar</CardTitle>
              <CardDescription>
                Hantera din profil och användarinställningar
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Profilinställningar kommer snart...
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="appearance" className="space-y-6">
          <ThemeSelector />
          <TrackingModeSelector />
        </TabsContent>

        <TabsContent value="vehicles" className="space-y-6">
          <VehicleConnectionSection />
        </TabsContent>

        <TabsContent value="developer" className="space-y-6">
          <DeveloperSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { ThemeSelector } from "@/components/settings/ThemeSelector";
import { TrackingModeSelector } from "@/components/settings/TrackingModeSelector";
import { VehicleConnectionSection } from "@/components/vehicle/VehicleConnectionSection";
import { useVehicleConnections } from "@/hooks/useVehicleConnections";
import { User, Settings as SettingsIcon, Car, Bell, Download, Shield, Globe, Palette, LogOut } from "lucide-react";

interface Profile {
  id: string;
  email?: string | null;
  full_name?: string | null;
  username?: string | null;
  bio?: string | null;
  company?: string | null;
  department?: string | null;
  avatar_url?: string | null;
  default_trip_type?: 'work' | 'personal' | 'unknown' | null;
  auto_tracking?: boolean | null;
  tracking_mode?: string | null;
  privacy_level?: string | null; // Allow any string from database
  default_vehicle_id?: string | null;
  fuel_consumption_l_per_100km?: number | null;
  distance_unit?: string | null; // Allow any string from database
  default_polling_frequency?: number | null;
  notifications_trip_start?: boolean | null;
  notifications_trip_end?: boolean | null;
  notifications_sync_status?: boolean | null;
  notifications_weekly_report?: boolean | null;
  notifications_email?: boolean | null;
  export_format?: string | null; // Allow any string from database
  date_format?: string | null; // Allow any string from database
  timezone?: string | null;
  language?: string | null; // Allow any string from database
  data_retention_months?: number | null;
  data_sharing_level?: string | null; // Allow any string from database
  auto_backup?: boolean | null;
  theme?: string | null; // Allow any string from database
  currency?: string | null; // Allow any string from database
  created_at?: string;
  updated_at?: string;
}

const Settings = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { connections: vehicles } = useVehicleConnections();
  const [searchParams] = useSearchParams();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const defaultTab = searchParams.get('tab') || 'profile';

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('sense_profiles')
        .select('*')
        .eq('id', user?.id)
        .single();

      if (error) throw error;
      setProfile(data);
    } catch (error) {
      console.error('Error fetching profile:', error);
      toast({
        title: "Fel",
        description: "Kunde inte ladda profilinställningar",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!user || !profile) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('sense_profiles')
        .update(updates)
        .eq('id', user.id);

      if (error) throw error;

      setProfile({ ...profile, ...updates });
      toast({
        title: "Sparat",
        description: "Profilinställningar uppdaterade",
      });
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        title: "Fel",
        description: "Kunde inte spara inställningar",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">
          <p>Kunde inte ladda profilinställningar</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold flex items-center space-x-2">
            <SettingsIcon className="h-8 w-8" />
            <span>Inställningar</span>
          </h1>
          <p className="text-muted-foreground">Hantera ditt konto och dina inställningar</p>
        </div>
        <Button variant="outline" onClick={handleSignOut} className="flex items-center space-x-2">
          <LogOut className="h-4 w-4" />
          <span>Logga ut</span>
        </Button>
      </div>

      <Tabs defaultValue={defaultTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="profile" className="flex items-center space-x-1">
            <User className="h-4 w-4" />
            <span className="hidden sm:inline">Profil</span>
          </TabsTrigger>
          <TabsTrigger value="vehicles" className="flex items-center space-x-1">
            <Car className="h-4 w-4" />
            <span className="hidden sm:inline">Fordon</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center space-x-1">
            <Bell className="h-4 w-4" />
            <span className="hidden sm:inline">Notiser</span>
          </TabsTrigger>
          <TabsTrigger value="export" className="flex items-center space-x-1">
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Export</span>
          </TabsTrigger>
          <TabsTrigger value="security" className="flex items-center space-x-1">
            <Shield className="h-4 w-4" />
            <span className="hidden sm:inline">Säkerhet</span>
          </TabsTrigger>
          <TabsTrigger value="appearance" className="flex items-center space-x-1">
            <Palette className="h-4 w-4" />
            <span className="hidden sm:inline">Utseende</span>
          </TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Grundläggande profil</CardTitle>
              <CardDescription>Hantera din personliga information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="full_name">Fullständigt namn</Label>
                  <Input
                    id="full_name"
                    value={profile.full_name || ''}
                    onChange={(e) => updateProfile({ full_name: e.target.value })}
                    placeholder="Ditt fullständiga namn"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="username">Användarnamn</Label>
                  <Input
                    id="username"
                    value={profile.username || ''}
                    onChange={(e) => updateProfile({ username: e.target.value })}
                    placeholder="Ditt användarnamn"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">E-post</Label>
                  <Input
                    id="email"
                    value={profile.email || ''}
                    disabled
                    className="bg-muted"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company">Företag</Label>
                  <Input
                    id="company"
                    value={profile.company || ''}
                    onChange={(e) => updateProfile({ company: e.target.value })}
                    placeholder="Ditt företag"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="department">Avdelning</Label>
                  <Input
                    id="department"
                    value={profile.department || ''}
                    onChange={(e) => updateProfile({ department: e.target.value })}
                    placeholder="Din avdelning"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="privacy_level">Integritetsnivå</Label>
                  <Select
                    value={profile.privacy_level || 'private'}
                    onValueChange={(value) => updateProfile({ privacy_level: value as 'public' | 'company' | 'private' })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="private">Privat</SelectItem>
                      <SelectItem value="company">Företag</SelectItem>
                      <SelectItem value="public">Offentlig</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="bio">Biografi</Label>
                <Textarea
                  id="bio"
                  value={profile.bio || ''}
                  onChange={(e) => updateProfile({ bio: e.target.value })}
                  placeholder="Berätta lite om dig själv..."
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Resinställningar</CardTitle>
              <CardDescription>Hantera standardinställningar för resor</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="default_trip_type">Standard restyp</Label>
                  <Select
                    value={profile.default_trip_type || 'unknown'}
                    onValueChange={(value) => updateProfile({ default_trip_type: value as 'work' | 'personal' | 'unknown' })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="work">Arbete</SelectItem>
                      <SelectItem value="personal">Privat</SelectItem>
                      <SelectItem value="unknown">Okänd</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="distance_unit">Avståndsenhet</Label>
                  <Select
                    value={profile.distance_unit || 'km'}
                    onValueChange={(value) => updateProfile({ distance_unit: value as 'km' | 'miles' })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="km">Kilometer</SelectItem>
                      <SelectItem value="miles">Miles</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="text-sm font-medium">Automatisk spårning</div>
                  <div className="text-sm text-muted-foreground">
                    Starta resor automatiskt
                  </div>
                </div>
                <Switch
                  checked={profile.auto_tracking || false}
                  onCheckedChange={(checked) => updateProfile({ auto_tracking: checked })}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Vehicles Tab */}
        <TabsContent value="vehicles" className="space-y-6">
          <VehicleConnectionSection />
          
          <Card>
            <CardHeader>
              <CardTitle>Spårningsinställningar</CardTitle>
              <CardDescription>Välj hur du vill spåra dina resor</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <TrackingModeSelector />
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Fordonsinställningar</CardTitle>
              <CardDescription>Hantera standardinställningar för dina fordon</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="default_vehicle">Standardfordon</Label>
                  <Select
                    value={profile.default_vehicle_id || ''}
                    onValueChange={(value) => updateProfile({ default_vehicle_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Välj standardfordon" />
                    </SelectTrigger>
                    <SelectContent>
                      {vehicles?.map((vehicle) => (
                        <SelectItem key={vehicle.id} value={vehicle.id}>
                          {vehicle.make} {vehicle.model} ({vehicle.year})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fuel_consumption">Bränslekonsumtion (L/100km)</Label>
                  <Input
                    id="fuel_consumption"
                    type="number"
                    step="0.1"
                    value={profile.fuel_consumption_l_per_100km || 7.5}
                    onChange={(e) => updateProfile({ fuel_consumption_l_per_100km: parseFloat(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="polling_frequency">Uppdateringsfrekvens (sekunder)</Label>
                  <Input
                    id="polling_frequency"
                    type="number"
                    value={profile.default_polling_frequency || 120}
                    onChange={(e) => updateProfile({ default_polling_frequency: parseInt(e.target.value) })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Notifieringsinställningar</CardTitle>
              <CardDescription>Hantera när och hur du får notifieringar</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="text-sm font-medium">Resa startar</div>
                    <div className="text-sm text-muted-foreground">
                      Få meddelande när en resa startar
                    </div>
                  </div>
                  <Switch
                    checked={profile.notifications_trip_start || false}
                    onCheckedChange={(checked) => updateProfile({ notifications_trip_start: checked })}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="text-sm font-medium">Resa slutar</div>
                    <div className="text-sm text-muted-foreground">
                      Få meddelande när en resa slutar
                    </div>
                  </div>
                  <Switch
                    checked={profile.notifications_trip_end || false}
                    onCheckedChange={(checked) => updateProfile({ notifications_trip_end: checked })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="text-sm font-medium">Synkroniseringsstatus</div>
                    <div className="text-sm text-muted-foreground">
                      Få meddelande om synkroniseringsproblem
                    </div>
                  </div>
                  <Switch
                    checked={profile.notifications_sync_status || false}
                    onCheckedChange={(checked) => updateProfile({ notifications_sync_status: checked })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="text-sm font-medium">Veckorapporter</div>
                    <div className="text-sm text-muted-foreground">
                      Få sammanfattning av veckan
                    </div>
                  </div>
                  <Switch
                    checked={profile.notifications_weekly_report || false}
                    onCheckedChange={(checked) => updateProfile({ notifications_weekly_report: checked })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="text-sm font-medium">E-postnotifieringar</div>
                    <div className="text-sm text-muted-foreground">
                      Få notifieringar via e-post
                    </div>
                  </div>
                  <Switch
                    checked={profile.notifications_email || false}
                    onCheckedChange={(checked) => updateProfile({ notifications_email: checked })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Export Tab */}
        <TabsContent value="export" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Export & rapporter</CardTitle>
              <CardDescription>Hantera hur data exporteras och visas</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="export_format">Exportformat</Label>
                  <Select
                    value={profile.export_format || 'csv'}
                    onValueChange={(value) => updateProfile({ export_format: value as 'csv' | 'excel' | 'pdf' })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="csv">CSV</SelectItem>
                      <SelectItem value="excel">Excel</SelectItem>
                      <SelectItem value="pdf">PDF</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="date_format">Datumformat</Label>
                  <Select
                    value={profile.date_format || 'swedish'}
                    onValueChange={(value) => updateProfile({ date_format: value as 'swedish' | 'international' })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="swedish">Svenskt (YYYY-MM-DD)</SelectItem>
                      <SelectItem value="international">Internationellt (MM/DD/YYYY)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="timezone">Tidszon</Label>
                  <Select
                    value={profile.timezone || 'Europe/Stockholm'}
                    onValueChange={(value) => updateProfile({ timezone: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Europe/Stockholm">Stockholm</SelectItem>
                      <SelectItem value="Europe/London">London</SelectItem>
                      <SelectItem value="America/New_York">New York</SelectItem>
                      <SelectItem value="UTC">UTC</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="currency">Valuta</Label>
                  <Select
                    value={profile.currency || 'SEK'}
                    onValueChange={(value) => updateProfile({ currency: value as 'SEK' | 'EUR' | 'USD' })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SEK">SEK (kr)</SelectItem>
                      <SelectItem value="EUR">EUR (€)</SelectItem>
                      <SelectItem value="USD">USD ($)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="language">Språk</Label>
                  <Select
                    value={profile.language || 'sv'}
                    onValueChange={(value) => updateProfile({ language: value as 'sv' | 'en' })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sv">Svenska</SelectItem>
                      <SelectItem value="en">English</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Datasäkerhet</CardTitle>
              <CardDescription>Hantera hur dina data lagras och delas</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="data_retention">Datalagring (månader)</Label>
                  <Input
                    id="data_retention"
                    type="number"
                    min="1"
                    max="120"
                    value={profile.data_retention_months || 24}
                    onChange={(e) => updateProfile({ data_retention_months: parseInt(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="data_sharing">Datadelning</Label>
                  <Select
                    value={profile.data_sharing_level || 'none'}
                    onValueChange={(value) => updateProfile({ data_sharing_level: value as 'none' | 'company' | 'authorized' })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Ingen delning</SelectItem>
                      <SelectItem value="company">Företag</SelectItem>
                      <SelectItem value="authorized">Auktoriserade</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="text-sm font-medium">Automatisk säkerhetskopiering</div>
                  <div className="text-sm text-muted-foreground">
                    Skapa automatiska säkerhetskopior av dina data
                  </div>
                </div>
                <Switch
                  checked={profile.auto_backup || false}
                  onCheckedChange={(checked) => updateProfile({ auto_backup: checked })}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Appearance Tab */}
        <TabsContent value="appearance" className="space-y-6">
          <ThemeSelector />
          <TrackingModeSelector />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Settings;
import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function ThemeSelector() {
  const { theme, setTheme } = useTheme();

  const themes = [
    {
      name: "System",
      value: "system",
      icon: Monitor,
      description: "Följer enhetens inställningar"
    },
    {
      name: "Ljust",
      value: "light", 
      icon: Sun,
      description: "Ljust tema"
    },
    {
      name: "Mörkt",
      value: "dark",
      icon: Moon,
      description: "Mörkt tema"
    }
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Utseende</CardTitle>
        <CardDescription>
          Välj hur appen ska se ut eller låt den följa enhetens inställningar
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {themes.map((themeOption) => {
            const Icon = themeOption.icon;
            const isActive = theme === themeOption.value;
            
            return (
              <Button
                key={themeOption.value}
                variant={isActive ? "default" : "outline"}
                className="h-auto p-4 flex flex-col items-center space-y-2"
                onClick={() => setTheme(themeOption.value)}
              >
                <Icon className="h-5 w-5" />
                <div className="text-center">
                  <div className="font-medium">{themeOption.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {themeOption.description}
                  </div>
                </div>
              </Button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
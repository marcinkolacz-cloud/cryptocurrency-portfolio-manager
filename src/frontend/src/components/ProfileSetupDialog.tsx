import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useSaveCallerUserProfile } from "../hooks/useQueries";

interface ProfileSetupDialogProps {
  language: "pl" | "en";
}

const translations = {
  pl: {
    title: "Witaj!",
    description: "Podaj swoje imię, aby rozpocząć",
    nameLabel: "Imię",
    namePlaceholder: "Wpisz swoje imię",
    save: "Zapisz",
    saving: "Zapisywanie...",
    success: "Profil zapisany pomyślnie",
    error: "Błąd zapisu profilu",
  },
  en: {
    title: "Welcome!",
    description: "Enter your name to get started",
    nameLabel: "Name",
    namePlaceholder: "Enter your name",
    save: "Save",
    saving: "Saving...",
    success: "Profile saved successfully",
    error: "Error saving profile",
  },
};

export default function ProfileSetupDialog({
  language,
}: ProfileSetupDialogProps) {
  const [name, setName] = useState("");
  const saveProfile = useSaveCallerUserProfile();
  const t = translations[language];

  const handleSave = async () => {
    if (!name.trim()) return;

    try {
      await saveProfile.mutateAsync({
        name: name.trim(),
        theme: "dark",
        language,
        colorScheme: "default",
      });
      toast.success(t.success);
    } catch (error) {
      console.error("Profile save error:", error);
      toast.error(t.error);
    }
  };

  return (
    <Dialog open={true}>
      <DialogContent className="sm:max-w-md" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{t.title}</DialogTitle>
          <DialogDescription>{t.description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">{t.nameLabel}</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t.namePlaceholder}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
            />
          </div>
          <Button
            onClick={handleSave}
            disabled={!name.trim() || saveProfile.isPending}
            className="w-full"
          >
            {saveProfile.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t.saving}
              </>
            ) : (
              t.save
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

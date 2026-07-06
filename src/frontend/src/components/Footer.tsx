import { Heart } from "lucide-react";

interface FooterProps {
  language: "pl" | "en";
}

export default function Footer({ language }: FooterProps) {
  return (
    <footer className="border-t border-border/40 bg-background/95 backdrop-blur">
      <div className="container flex h-14 items-center justify-center px-4">
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          © 2025. {language === "pl" ? "Stworzone z" : "Built with"}{" "}
          <Heart className="h-4 w-4 fill-red-500 text-red-500" />{" "}
          {language === "pl" ? "używając" : "using"}{" "}
          <a
            href="https://caffeine.ai"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-foreground hover:underline"
          >
            caffeine.ai
          </a>
        </p>
      </div>
    </footer>
  );
}

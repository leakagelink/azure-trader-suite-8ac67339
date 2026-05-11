import { useTranslation } from "react-i18next";
import { Globe } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { SUPPORTED_LANGUAGES } from "@/i18n";

interface LanguageSwitcherProps {
  variant?: "ghost" | "outline";
  size?: "sm" | "default" | "icon";
  showLabel?: boolean;
  className?: string;
}

export function LanguageSwitcher({
  variant = "ghost",
  size = "sm",
  showLabel = true,
  className,
}: LanguageSwitcherProps) {
  const { i18n, t } = useTranslation();
  const current =
    SUPPORTED_LANGUAGES.find((l) => l.code === i18n.resolvedLanguage) ??
    SUPPORTED_LANGUAGES[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size={size} className={className} aria-label={t("common.language")}>
          <Globe className="h-4 w-4" />
          {showLabel && size !== "icon" && (
            <span className="ml-1.5 text-xs font-medium">{current.label}</span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-32">
        {SUPPORTED_LANGUAGES.map((lng) => (
          <DropdownMenuItem
            key={lng.code}
            onSelect={() => i18n.changeLanguage(lng.code)}
            className={lng.code === i18n.resolvedLanguage ? "font-semibold text-primary" : ""}
          >
            {lng.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

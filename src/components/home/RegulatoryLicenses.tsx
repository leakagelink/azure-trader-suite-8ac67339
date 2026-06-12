import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShieldCheck, FileText, ExternalLink } from "lucide-react";
import pdfAsset from "@/assets/company-document.pdf.asset.json";

interface License {
  authority: string;
  shortName: string;
  entity: string;
  license: string;
  jurisdiction: string;
  website?: string;
  description: string;
}

const licenses: License[] = [
  {
    authority: "Jordan Securities Commission",
    shortName: "JSC",
    entity: "Oslo Capital Jordan LLC",
    license: "Reg. No. 60191",
    jurisdiction: "Hashemite Kingdom of Jordan",
    website: "www.oslocapitals.jo",
    description:
      "Regulatory body responsible to license, regulate and supervise the conduct of business in the non-bank financial services sector in Jordan.",
  },
  {
    authority: "Capital Markets Authority",
    shortName: "CMA",
    entity: "Oslo Capital (KE) LLC",
    license: "License No. 1081",
    jurisdiction: "Kenya",
    website: "www.oslocapitals.ke",
    description:
      "Authorized as a non-dealing online foreign exchange broker by the Capital Markets Authority of Kenya.",
  },
  {
    authority: "Cyprus Securities and Exchange Commission",
    shortName: "CySEC",
    entity: "Oslo Capital (Cy) LLC",
    license: "License No. 182/015",
    jurisdiction: "Cyprus",
    website: "www.oslocapitalllc.eu",
    description:
      "Cyprus Investment Firm authorized and regulated by CySEC, the independent public supervisory authority for investment services in Cyprus.",
  },
  {
    authority: "Central Bank of Curaçao and Sint Maarten",
    shortName: "CBCS",
    entity: "The Fx Streets B.V.",
    license: "License No. 0002ION",
    jurisdiction: "Curaçao & Sint Maarten",
    description:
      "Securities Intermediary authorized and regulated by the Central Bank of Curaçao and Sint Maarten for services outside the EEA.",
  },
  {
    authority: "Financial Services Authority",
    shortName: "FSA",
    entity: "The Fx Streets LLC",
    license: "License No. SE0389",
    jurisdiction: "Seychelles",
    description:
      "Securities Dealer authorized and regulated by the Seychelles FSA — the autonomous regulator for non-bank financial services.",
  },
];

export const RegulatoryLicenses = () => {
  return (
    <section className="py-12 sm:py-20 relative">
      <div className="container mx-auto px-4">
        <div className="text-center mb-10">
          <Badge
            variant="outline"
            className="mb-3 bg-primary/5 text-primary border-primary/30"
          >
            <ShieldCheck className="h-3 w-3 mr-1" /> Regulation & Compliance
          </Badge>
          <h2 className="text-2xl sm:text-4xl md:text-5xl font-black mb-3">
            Globally{" "}
            <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Licensed & Regulated
            </span>
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto">
            Our group operates under multiple top-tier regulators across the
            world, ensuring transparency, trust and client protection.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 max-w-6xl mx-auto">
          {licenses.map((l) => (
            <Card
              key={l.shortName}
              className="p-5 bg-card border-border/60 hover:border-primary/40 transition-colors shadow-sm hover:shadow-md"
            >
              <div className="flex items-start gap-3 mb-3">
                <div className="h-11 w-11 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm text-primary">
                    {l.shortName}
                  </div>
                  <div className="text-xs text-muted-foreground line-clamp-2">
                    {l.authority}
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    Entity
                  </div>
                  <div className="text-sm font-semibold">{l.entity}</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary" className="text-[11px]">
                    {l.license}
                  </Badge>
                  <Badge variant="outline" className="text-[11px]">
                    {l.jurisdiction}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed pt-1">
                  {l.description}
                </p>
                {l.website && (
                  <div className="flex items-center gap-1 text-xs text-primary pt-1">
                    <ExternalLink className="h-3 w-3" />
                    <span className="truncate">{l.website}</span>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>

        <div className="flex justify-center mt-8">
          <Button asChild variant="outline" size="lg">
            <a
              href={pdfAsset.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              <FileText className="h-4 w-4 mr-2" />
              View Full Regulatory Document
            </a>
          </Button>
        </div>
      </div>
    </section>
  );
};

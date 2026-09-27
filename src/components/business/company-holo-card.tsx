"use client";

import { HoloCard } from "@heroui-pro/react";
import { useEffect, useState } from "react";
import { Mail, MapPin, Phone, ArrowUpRight } from "lucide-react";
import type { PublicCompanyCard } from "@/lib/company-card";

export function CompanyHoloCard({ card, interactive = true }: { card: PublicCompanyCard; interactive?: boolean }) {
  const [canTilt, setCanTilt] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(min-width: 640px) and (hover: hover) and (pointer: fine)");
    const update = () => setCanTilt(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return (
    <HoloCard className="company-holo" isInteractive={interactive && canTilt} parallaxStrength={3}
      gradient="radial-gradient(ellipse at 100% 0%, #74372e 0%, transparent 52%), linear-gradient(135deg, #30323c, #17191f 60%, #242633)"
      aria-label={`นามบัตร ${card.name}`}>
      <HoloCard.Rotator>
        <HoloCard.Frame>
          <HoloCard.Surface data-company-card-image>
            <HoloCard.Pattern />
            <HoloCard.Content parallax={false} className="company-holo__content">
              <div className="flex items-start justify-between gap-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/beyonddev-logo.png" alt="Beyond Dev Tech Solution" width={917} height={338}
                  className="h-auto w-44 max-w-[65%] shrink-0 object-contain" />
                <span className="pt-2 text-xs font-medium tracking-[0.18em] text-white/70">COMPANY<br />PROFILE</span>
              </div>
              <div className="space-y-2">
                <h2 className="text-xl leading-relaxed font-semibold break-words sm:text-2xl">{card.name}</h2>
                {card.nameEn && <p className="text-sm break-words text-white/70">{card.nameEn}</p>}
                {card.taxId && <p className="text-sm text-white/70">เลขประจำตัวผู้เสียภาษี <span className="inline-block font-mono text-white/90">{card.taxId}</span></p>}
              </div>
              <dl className="space-y-4 text-sm leading-relaxed">
                {card.address && <div className="flex gap-3"><dt><MapPin aria-label="ที่อยู่" className="mt-0.5 size-4 text-white/60" /></dt><dd className="min-w-0 whitespace-pre-line break-words">{card.address}</dd></div>}
                {card.phone && <div className="flex gap-3"><dt><Phone aria-label="โทรศัพท์" className="mt-0.5 size-4 text-white/60" /></dt><dd className="min-w-0 break-words">{card.phone}</dd></div>}
                {card.email && <div className="flex gap-3"><dt><Mail aria-label="อีเมล" className="mt-0.5 size-4 text-white/60" /></dt><dd className="min-w-0 break-all">{card.email}</dd></div>}
              </dl>
              <div className="flex items-end justify-between gap-3 pt-2 text-xs text-white/60">
                <span>Beyond expectations.<br /><span className="text-white/90">Beyond Dev.</span></span>
                <ArrowUpRight className="size-6 text-orange-300" aria-hidden="true" />
              </div>
            </HoloCard.Content>
            <HoloCard.Shine data-export-ignore />
          </HoloCard.Surface>
        </HoloCard.Frame>
      </HoloCard.Rotator>
    </HoloCard>
  );
}

export const VIDEO_PRICE_PROMO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
export const VIDEO_PRICE_PROMO_ANY_RESOLUTION = "any" as const;

export interface VideoPricePromoPeriod {
  readonly id: string;
  readonly resolution: string;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly discountFold: number;
}

export interface VideoModelPricePromo extends VideoPricePromoPeriod {}

export interface LibtvPricePromo extends VideoPricePromoPeriod {
  readonly canonicalId: string;
  readonly withReference: boolean;
}

export function createVideoPricePromoId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return `promo-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function formatVideoPricePromoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatVideoPricePromoMonthDay(value: string): string {
  if (!isVideoPricePromoDate(value)) {
    return value;
  }
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  return `${month}月${day}日`;
}

export function formatVideoPricePromoDateRange(
  startsAt: string,
  endsAt: string
): string {
  return `${formatVideoPricePromoMonthDay(startsAt)}~${formatVideoPricePromoMonthDay(
    endsAt
  )}`;
}

export function isVideoPricePromoDate(value: string): boolean {
  return VIDEO_PRICE_PROMO_DATE_PATTERN.test(value);
}

export function isVideoPricePromoFold(value: number): boolean {
  if (!Number.isFinite(value) || value <= 0 || value > 10) {
    return false;
  }
  return Math.abs(value - normalizeVideoPricePromoFold(value)) < 1e-8;
}

export function readVideoPricePromoFold(value: unknown): number | undefined {
  if (typeof value !== "number" || !isVideoPricePromoFold(value)) {
    return undefined;
  }
  return normalizeVideoPricePromoFold(value);
}

export function normalizeVideoPricePromoFold(value: number): number {
  return Math.round(value * 10) / 10;
}

export function formatVideoPricePromoFold(value: number): string {
  const fold = normalizeVideoPricePromoFold(value);
  return Number.isInteger(fold) ? String(fold) : fold.toFixed(1);
}

export function isVideoPricePromoFoldDraft(raw: string): boolean {
  return raw === "" || /^\d{1,2}(\.\d?)?$/.test(raw);
}

export function isVideoPricePromoAnyResolution(resolution: string): boolean {
  return resolution.trim().toLowerCase() === VIDEO_PRICE_PROMO_ANY_RESOLUTION;
}

export function videoPricePromoResolutionMatches(
  promoResolution: string,
  selectedResolution: string
): boolean {
  const promoKey = promoResolution.trim().toLowerCase();
  const selectedKey = selectedResolution.trim().toLowerCase();
  return (
    promoKey === VIDEO_PRICE_PROMO_ANY_RESOLUTION || promoKey === selectedKey
  );
}

export function videoPricePromoMultiplier(fold: number): number {
  return fold / 10;
}

export function applyVideoPricePromoFold(value: number, fold: number): number {
  return value * videoPricePromoMultiplier(fold);
}

export function isVideoPricePromoActive(
  promo: Pick<VideoPricePromoPeriod, "startsAt" | "endsAt">,
  now: Date = new Date()
): boolean {
  if (
    !isVideoPricePromoDate(promo.startsAt) ||
    !isVideoPricePromoDate(promo.endsAt)
  ) {
    return false;
  }
  const today = formatVideoPricePromoDate(now);
  return promo.startsAt <= today && today <= promo.endsAt;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readPromoId(value: unknown): string {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  return createVideoPricePromoId();
}

function readPromoPeriod(
  value: Record<string, unknown>
): VideoPricePromoPeriod | null {
  const resolution =
    typeof value.resolution === "string"
      ? value.resolution.trim().toLowerCase()
      : "";
  const startsAt =
    typeof value.startsAt === "string" ? value.startsAt.trim() : "";
  const endsAt = typeof value.endsAt === "string" ? value.endsAt.trim() : "";
  const discountFold =
    typeof value.discountFold === "number" ? value.discountFold : Number.NaN;
  if (!resolution) {
    return null;
  }
  if (!isVideoPricePromoDate(startsAt) || !isVideoPricePromoDate(endsAt)) {
    return null;
  }
  if (
    !Number.isFinite(discountFold) ||
    discountFold <= 0 ||
    discountFold > 10
  ) {
    return null;
  }
  return {
    id: readPromoId(value.id),
    resolution,
    startsAt,
    endsAt,
    discountFold: normalizeVideoPricePromoFold(discountFold),
  };
}

export function readVideoModelPricePromo(
  value: unknown
): VideoModelPricePromo | null {
  if (!isRecord(value)) {
    return null;
  }
  return readPromoPeriod(value);
}

export function readVideoModelPricePromos(
  value: unknown
): readonly VideoModelPricePromo[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((entry) => {
    const promo = readVideoModelPricePromo(entry);
    return promo ? [promo] : [];
  });
}

export function readLibtvPricePromo(value: unknown): LibtvPricePromo | null {
  if (!isRecord(value)) {
    return null;
  }
  const period = readPromoPeriod(value);
  if (!period) {
    return null;
  }
  const canonicalId =
    typeof value.canonicalId === "string" ? value.canonicalId.trim() : "";
  if (!canonicalId) {
    return null;
  }
  if (typeof value.withReference !== "boolean") {
    return null;
  }
  return {
    ...period,
    canonicalId,
    withReference: value.withReference,
  };
}

export function readLibtvPricePromos(
  value: unknown
): readonly LibtvPricePromo[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((entry) => {
    const promo = readLibtvPricePromo(entry);
    return promo ? [promo] : [];
  });
}

function pickLowestFoldPromo<T extends { readonly discountFold: number }>(
  promos: readonly T[]
): T | null {
  if (promos.length === 0) {
    return null;
  }
  return promos.reduce((best, current) =>
    current.discountFold < best.discountFold ? current : best
  );
}

export function matchVideoModelPricePromo(
  promos: readonly VideoModelPricePromo[],
  resolution: string,
  now: Date = new Date()
): VideoModelPricePromo | null {
  return pickLowestFoldPromo(
    promos.filter(
      (promo) =>
        videoPricePromoResolutionMatches(promo.resolution, resolution) &&
        isVideoPricePromoActive(promo, now)
    )
  );
}

export function matchLibtvPricePromo(
  promos: readonly LibtvPricePromo[],
  params: {
    readonly canonicalId: string;
    readonly resolution: string;
    readonly withReference: boolean;
    readonly now?: Date;
  }
): LibtvPricePromo | null {
  const canonicalId = params.canonicalId.trim();
  const resolution = params.resolution.trim().toLowerCase();
  const now = params.now ?? new Date();
  return pickLowestFoldPromo(
    promos.filter(
      (promo) =>
        promo.canonicalId === canonicalId &&
        videoPricePromoResolutionMatches(promo.resolution, resolution) &&
        promo.withReference === params.withReference &&
        isVideoPricePromoActive(promo, now)
    )
  );
}

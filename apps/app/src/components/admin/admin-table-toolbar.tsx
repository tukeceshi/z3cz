import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { useTranslation } from "@/components/locale-provider";
import { SearchInput } from "@/components/ui/search-input";

interface AdminTableToolbarProps {
  searchPlaceholder?: string;
  search?: {
    value: string;
    onChange: (value: string) => void;
    onSubmit: () => void;
    onClear?: () => void;
    showClear?: boolean;
  };
  children?: ReactNode;
}

export function AdminTableToolbar({
  searchPlaceholder,
  search,
  children,
}: AdminTableToolbarProps) {
  const { t } = useTranslation();
  const resolvedPlaceholder =
    searchPlaceholder ?? t("admin.toolbar.searchPlaceholder");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    search?.onSubmit();
  };

  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      {search && (
        <form onSubmit={handleSubmit} className="flex gap-2 flex-1 min-w-0">
          <div className="flex-1 max-w-sm">
            <SearchInput
              placeholder={resolvedPlaceholder}
              value={search.value}
              onChange={(e) => search.onChange(e.target.value)}
            />
          </div>
          <Button type="submit" variant="outline">
            {t("admin.toolbar.search")}
          </Button>
          {search.showClear && search.onClear && (
            <Button type="button" variant="ghost" onClick={search.onClear}>
              {t("admin.toolbar.clear")}
            </Button>
          )}
        </form>
      )}
      {children}
    </div>
  );
}

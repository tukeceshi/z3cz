import * as React from "react";
import { Link as RouterLink } from "react-router";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

import { useBreadcrumbs } from "./page-context";

export function AppHeaderBreadcrumb() {
  const { breadcrumbs } = useBreadcrumbs();

  // Don't render if there are no breadcrumb items
  if (breadcrumbs.length === 0) {
    return null;
  }

  return (
    <Breadcrumb className="flex min-w-0">
      <BreadcrumbList className="flex-nowrap">
        {breadcrumbs.map((item, index) => {
          const isLast = index === breadcrumbs.length - 1;
          return (
            <React.Fragment key={`${item.label}-${index}`}>
              <BreadcrumbItem className="min-w-0">
                {isLast || !item.to ? (
                  <span className="inline-flex min-w-0 items-center gap-2">
                    {item.onClick ? (
                      <button
                        type="button"
                        className="truncate max-w-[10rem] cursor-pointer rounded-sm text-foreground transition-colors hover:text-foreground/80 sm:max-w-[16rem]"
                        onClick={item.onClick}
                        title={item.onClickTitle}
                        aria-label={item.onClickTitle ?? item.label}
                      >
                        {item.label}
                      </button>
                    ) : (
                      <BreadcrumbPage className="truncate max-w-[10rem] sm:max-w-[16rem]">
                        {item.label}
                      </BreadcrumbPage>
                    )}
                    {item.trailing}
                  </span>
                ) : (
                  <BreadcrumbLink asChild className="hidden sm:inline-flex">
                    <RouterLink to={item.to}>{item.label}</RouterLink>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {!isLast && (
                <BreadcrumbSeparator className="hidden sm:block" />
              )}
            </React.Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

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
                  <span className="inline-flex items-center gap-1.5 min-w-0">
                    <BreadcrumbPage className="truncate max-w-[10rem] sm:max-w-[16rem]">
                      {item.label}
                    </BreadcrumbPage>
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

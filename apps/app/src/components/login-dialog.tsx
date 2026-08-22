import type { JWTTokenPayload } from "@dafthunk/types";
import X from "lucide-react/icons/x";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router";

import { useAuth } from "@/components/auth-context";
import { LoginForm } from "@/components/login-form";
import { useTranslation } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  getDashboardPath,
  isSafeAppPath,
} from "@/utils/auth-navigation";
import {
  registerLoginDialogOpener,
  type OpenLoginOptions,
} from "@/components/login-dialog-bridge";

export type { OpenLoginOptions };

interface LoginDialogContextValue {
  readonly open: boolean;
  openLogin: (options?: OpenLoginOptions) => void;
  closeLogin: () => void;
}

const LoginDialogContext = createContext<LoginDialogContextValue | undefined>(
  undefined
);

interface LoginDialogState {
  readonly open: boolean;
  readonly goToConsole: boolean;
  readonly dismissible: boolean;
  readonly subAccountInvitationId?: string;
  readonly returnTo?: string;
}

const CLOSED_STATE: LoginDialogState = {
  open: false,
  goToConsole: false,
  dismissible: true,
};

export function LoginDialogProvider({ children }: { children: ReactNode }) {
  const { refreshUser } = useAuth();
  const { t, siteSettings } = useTranslation();
  const navigate = useNavigate();
  const [state, setState] = useState<LoginDialogState>(CLOSED_STATE);
  const stateRef = useRef(state);
  stateRef.current = state;

  const openLogin = useCallback((options?: OpenLoginOptions) => {
    setState((current) => ({
      open: true,
      goToConsole: options?.goToConsole ?? (current.open && current.goToConsole),
      dismissible:
        options?.dismissible === false
          ? false
          : current.open
            ? current.dismissible && options?.dismissible !== false
            : options?.dismissible !== false,
      subAccountInvitationId:
        options?.subAccountInvitationId ??
        (current.open ? current.subAccountInvitationId : undefined),
      returnTo:
        options?.returnTo ?? (current.open ? current.returnTo : undefined),
    }));
  }, []);

  const closeLogin = useCallback(() => {
    setState(CLOSED_STATE);
  }, []);

  useEffect(() => {
    return registerLoginDialogOpener(openLogin);
  }, [openLogin]);

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      openLogin();
      return;
    }
    if (!state.dismissible) {
      return;
    }
    closeLogin();
  };

  const handleAuthenticated = async (user: JWTTokenPayload) => {
    const snapshot = stateRef.current;
    await refreshUser();
    closeLogin();
    if (
      snapshot.returnTo &&
      snapshot.returnTo !== "/" &&
      !snapshot.returnTo.startsWith("/login") &&
      isSafeAppPath(snapshot.returnTo)
    ) {
      navigate(snapshot.returnTo, { replace: true });
      return;
    }
    if (!snapshot.goToConsole) {
      return;
    }
    const dashboardPath = getDashboardPath(user);
    if (dashboardPath) {
      navigate(dashboardPath, { replace: true });
    }
  };

  // /login then sends admins to /admin and everyone else to the org console
  const oauthReturnTo = state.goToConsole
    ? "/login"
    : state.returnTo ??
      (typeof window === "undefined"
        ? undefined
        : `${window.location.pathname}${window.location.search}`);

  const contextValue = useMemo<LoginDialogContextValue>(
    () => ({
      open: state.open,
      openLogin,
      closeLogin,
    }),
    [state.open, openLogin, closeLogin]
  );

  return (
    <LoginDialogContext.Provider value={contextValue}>
      {children}
      <Dialog open={state.open} onOpenChange={handleOpenChange}>
        <DialogContent
          className="max-h-[90vh] overflow-y-auto bg-white dark:bg-neutral-800 dark:border-neutral-700 sm:max-w-md"
          onPointerDownOutside={(event) => {
            if (!state.dismissible) {
              event.preventDefault();
            }
          }}
          onEscapeKeyDown={(event) => {
            if (!state.dismissible) {
              event.preventDefault();
            }
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <DialogTitle>{t("auth.loginRegister")}</DialogTitle>
              <DialogDescription className="sr-only">
                {siteSettings.siteTagline}
              </DialogDescription>
            </div>
            {state.dismissible ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0"
                onClick={closeLogin}
                aria-label={t("common.cancel")}
              >
                <X className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
          <LoginForm
            variant="dialog"
            returnTo={oauthReturnTo}
            subAccountInvitationId={state.subAccountInvitationId}
            onAuthenticated={(user) => {
              void handleAuthenticated(user);
            }}
          />
        </DialogContent>
      </Dialog>
    </LoginDialogContext.Provider>
  );
}

export function useLoginDialog(): LoginDialogContextValue {
  const context = useContext(LoginDialogContext);
  if (context === undefined) {
    throw new Error("useLoginDialog must be used within a LoginDialogProvider");
  }
  return context;
}

export function useRequireLoginDialog(): boolean {
  const { isAuthenticated, isLoading } = useAuth();
  const { openLogin } = useLoginDialog();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      openLogin({ dismissible: false, goToConsole: false });
    }
  }, [isAuthenticated, isLoading, openLogin]);

  return isLoading || !isAuthenticated;
}

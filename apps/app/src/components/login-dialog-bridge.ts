export interface OpenLoginOptions {
  readonly goToConsole?: boolean;
  readonly dismissible?: boolean;
  readonly subAccountInvitationId?: string;
  readonly returnTo?: string;
}

type LoginDialogOpener = (options?: OpenLoginOptions) => void;

let loginDialogOpener: LoginDialogOpener | null = null;

export function registerLoginDialogOpener(
  opener: LoginDialogOpener
): () => void {
  loginDialogOpener = opener;
  return () => {
    if (loginDialogOpener === opener) {
      loginDialogOpener = null;
    }
  };
}

export function requestLoginDialog(options?: OpenLoginOptions): void {
  loginDialogOpener?.(options);
}

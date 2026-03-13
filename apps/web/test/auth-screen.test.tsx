import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { step?: number; total?: number }) => {
      if (key === "register.stepOf" && options) {
        return `${options.step}/${options.total}`;
      }

      return key;
    }
  })
}));

import { AuthScreen, type AuthScreenProps } from "../src/app/AuthScreen";

const AUTH_INTRO_SESSION_KEY = "ebonkeep.authIntroSeen";

function createProps(overrides: Partial<AuthScreenProps> = {}): AuthScreenProps {
  return {
    layoutMode: "standard",
    resetToken: null,
    newPassword: "",
    confirmPassword: "",
    resetPasswordMessage: null,
    authMode: "login",
    authUsername: "",
    authEmail: "",
    authPassword: "",
    authRepeatPassword: "",
    showPassword: false,
    showRepeatPassword: false,
    authClass: "juggernaut",
    authPortraitId: "str_01",
    authBackgroundId: "bg_01",
    showForgotPassword: false,
    forgotPasswordEmail: "",
    forgotPasswordMessage: null,
    error: null,
    onResetPasswordSubmit: (event) => event.preventDefault(),
    onNewPasswordChange: () => {},
    onConfirmPasswordChange: () => {},
    onAuthModeChange: () => {},
    onLoginSubmit: (event) => event.preventDefault(),
    onRegisterSubmit: (event) => event.preventDefault(),
    onAuthUsernameChange: () => {},
    onAuthEmailChange: () => {},
    onAuthPasswordChange: () => {},
    onAuthRepeatPasswordChange: () => {},
    onToggleShowPassword: () => {},
    onToggleShowRepeatPassword: () => {},
    onShowForgotPassword: () => {},
    onForgotPasswordClose: () => {},
    onAuthClassChange: () => {},
    onAuthPortraitChange: () => {},
    onAuthBackgroundChange: () => {},
    onGuestLogin: () => {},
    onForgotPasswordSubmit: (event) => event.preventDefault(),
    onForgotPasswordEmailChange: () => {},
    ...overrides
  };
}

describe("AuthScreen intro", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it("starts with the hourglass intro before revealing auth content", () => {
    render(<AuthScreen {...createProps()} />);

    expect(screen.getByTestId("auth-intro-loader").getAttribute("data-state")).toBe("visible");
    expect(screen.getByTestId("auth-content").getAttribute("data-state")).toBe("hidden");
  });

  it("reveals the auth content after the video becomes ready", () => {
    render(<AuthScreen {...createProps()} />);

    const video = screen.getByTestId("auth-intro-video");
    fireEvent.loadedData(video);

    expect(screen.getByTestId("auth-content").getAttribute("data-state")).toBe("hidden");

    act(() => {
      vi.advanceTimersByTime(950);
    });

    expect(screen.getByTestId("auth-content").getAttribute("data-state")).toBe("visible");
    expect(sessionStorage.getItem(AUTH_INTRO_SESSION_KEY)).toBe("1");
  });

  it("does not skip the loader until a previously seen intro video is ready", () => {
    sessionStorage.setItem(AUTH_INTRO_SESSION_KEY, "1");

    render(<AuthScreen {...createProps()} />);

    expect(screen.getByTestId("auth-intro-loader").getAttribute("data-state")).toBe("visible");
    expect(screen.getByTestId("auth-content").getAttribute("data-state")).toBe("hidden");

    fireEvent.loadedData(screen.getByTestId("auth-intro-video"));

    expect(screen.getByTestId("auth-intro-loader").getAttribute("data-state")).toBe("hidden");
    expect(screen.getByTestId("auth-content").getAttribute("data-state")).toBe("visible");
  });

  it("falls back to the auth form if the video never becomes ready", () => {
    render(<AuthScreen {...createProps()} />);

    act(() => {
      vi.advanceTimersByTime(4600);
    });

    expect(screen.getByTestId("auth-content").getAttribute("data-state")).toBe("visible");
  });
});

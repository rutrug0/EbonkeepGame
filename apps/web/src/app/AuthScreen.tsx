import type { FormEvent } from "react";

import type { PlayerClass } from "@ebonkeep/shared/core";

import type { LayoutMode } from "./navigation";
import i18n from "../i18n";

export type AuthScreenProps = {
  layoutMode: LayoutMode;
  resetToken: string | null;
  newPassword: string;
  confirmPassword: string;
  resetPasswordMessage: string | null;
  authMode: "login" | "register";
  authUsername: string;
  authEmail: string;
  authPassword: string;
  authRepeatPassword: string;
  showPassword: boolean;
  showRepeatPassword: boolean;
  authClass: PlayerClass;
  showForgotPassword: boolean;
  forgotPasswordEmail: string;
  forgotPasswordMessage: string | null;
  error: string | null;
  onResetPasswordSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onNewPasswordChange: (value: string) => void;
  onConfirmPasswordChange: (value: string) => void;
  onAuthModeChange: (mode: "login" | "register") => void;
  onLoginSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onRegisterSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onAuthUsernameChange: (value: string) => void;
  onAuthEmailChange: (value: string) => void;
  onAuthPasswordChange: (value: string) => void;
  onAuthRepeatPasswordChange: (value: string) => void;
  onToggleShowPassword: () => void;
  onToggleShowRepeatPassword: () => void;
  onShowForgotPassword: () => void;
  onForgotPasswordClose: () => void;
  onAuthClassChange: (value: PlayerClass) => void;
  onGuestLogin: () => void;
  onForgotPasswordSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onForgotPasswordEmailChange: (value: string) => void;
};

export function AuthScreen(props: AuthScreenProps) {
  return (
    <main className={`appRoot layout-${props.layoutMode}`}>
      <div className="appSurface">
        <section className="authPage">
          <section className="authCard">
            <h1>{i18n.t("app.title")}</h1>
            <p>{i18n.t("auth.subtitle")}</p>

            {props.resetToken ? (
              <>
                <h2 style={{ marginTop: 0 }}>Reset Your Password</h2>
                <form
                  onSubmit={props.onResetPasswordSubmit}
                  style={{ display: "flex", flexDirection: "column", gap: "12px" }}
                >
                  <input
                    type="password"
                    placeholder="New Password"
                    value={props.newPassword}
                    onChange={(event) => props.onNewPasswordChange(event.target.value)}
                    required
                    minLength={8}
                    style={{ padding: "8px", fontSize: "16px" }}
                  />
                  <input
                    type="password"
                    placeholder="Confirm New Password"
                    value={props.confirmPassword}
                    onChange={(event) => props.onConfirmPasswordChange(event.target.value)}
                    required
                    minLength={8}
                    style={{ padding: "8px", fontSize: "16px" }}
                  />
                  <button type="submit" style={{ padding: "10px", fontSize: "16px", fontWeight: "bold" }}>
                    Reset Password
                  </button>
                </form>
                {props.resetPasswordMessage ? (
                  <div
                    style={{
                      marginTop: "12px",
                      padding: "8px",
                      background: props.resetPasswordMessage.includes("success")
                        ? "rgba(34, 197, 94, 0.2)"
                        : "rgba(239, 68, 68, 0.2)",
                      borderRadius: "4px"
                    }}
                  >
                    {props.resetPasswordMessage}
                  </div>
                ) : null}
              </>
            ) : (
              <>
                <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
                  <button
                    onClick={() => props.onAuthModeChange("login")}
                    style={{
                      flex: 1,
                      opacity: props.authMode === "login" ? 1 : 0.6,
                      fontWeight: props.authMode === "login" ? "bold" : "normal"
                    }}
                  >
                    Login
                  </button>
                  <button
                    onClick={() => props.onAuthModeChange("register")}
                    style={{
                      flex: 1,
                      opacity: props.authMode === "register" ? 1 : 0.6,
                      fontWeight: props.authMode === "register" ? "bold" : "normal"
                    }}
                  >
                    Register
                  </button>
                </div>

                <form
                  onSubmit={props.authMode === "login" ? props.onLoginSubmit : props.onRegisterSubmit}
                  style={{ display: "flex", flexDirection: "column", gap: "12px" }}
                >
                  {props.authMode === "register" ? (
                    <input
                      type="text"
                      placeholder="Username"
                      value={props.authUsername}
                      onChange={(event) => props.onAuthUsernameChange(event.target.value)}
                      required
                      minLength={3}
                      maxLength={32}
                      pattern="[a-zA-Z0-9_]+"
                      title="Username can only contain letters, numbers, and underscores"
                      style={{ padding: "8px", fontSize: "16px" }}
                    />
                  ) : null}
                  <input
                    type="email"
                    placeholder="Email"
                    value={props.authEmail}
                    onChange={(event) => props.onAuthEmailChange(event.target.value)}
                    required
                    style={{ padding: "8px", fontSize: "16px" }}
                  />
                  <div style={{ position: "relative" }}>
                    <input
                      type={props.showPassword ? "text" : "password"}
                      placeholder="Password"
                      value={props.authPassword}
                      onChange={(event) => props.onAuthPasswordChange(event.target.value)}
                      required
                      minLength={props.authMode === "register" ? 8 : 6}
                      style={{
                        padding: "8px",
                        paddingRight: "40px",
                        fontSize: "16px",
                        width: "100%",
                        boxSizing: "border-box"
                      }}
                    />
                    <button
                      type="button"
                      onClick={props.onToggleShowPassword}
                      style={{
                        position: "absolute",
                        right: "8px",
                        top: "50%",
                        transform: "translateY(-50%)",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        fontSize: "18px",
                        padding: "4px"
                      }}
                      title={props.showPassword ? "Hide password" : "Show password"}
                    >
                      {props.showPassword ? "👁️" : "👁️‍🗨️"}
                    </button>
                  </div>

                  {props.authMode === "register" ? (
                    <div style={{ position: "relative" }}>
                      <input
                        type={props.showRepeatPassword ? "text" : "password"}
                        placeholder="Repeat Password"
                        value={props.authRepeatPassword}
                        onChange={(event) => props.onAuthRepeatPasswordChange(event.target.value)}
                        required
                        minLength={8}
                        style={{
                          padding: "8px",
                          paddingRight: "40px",
                          fontSize: "16px",
                          width: "100%",
                          boxSizing: "border-box"
                        }}
                      />
                      <button
                        type="button"
                        onClick={props.onToggleShowRepeatPassword}
                        style={{
                          position: "absolute",
                          right: "8px",
                          top: "50%",
                          transform: "translateY(-50%)",
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          fontSize: "18px",
                          padding: "4px"
                        }}
                        title={props.showRepeatPassword ? "Hide password" : "Show password"}
                      >
                        {props.showRepeatPassword ? "👁️" : "👁️‍🗨️"}
                      </button>
                    </div>
                  ) : null}

                  {props.authMode === "login" ? (
                    <div style={{ textAlign: "right" }}>
                      <button
                        type="button"
                        onClick={props.onShowForgotPassword}
                        style={{
                          background: "none",
                          border: "none",
                          color: "#60a5fa",
                          cursor: "pointer",
                          fontSize: "14px",
                          textDecoration: "underline",
                          padding: 0
                        }}
                      >
                        Forgot Password?
                      </button>
                    </div>
                  ) : null}

                  {props.authMode === "register" ? (
                    <select
                      value={props.authClass}
                      onChange={(event) => props.onAuthClassChange(event.target.value as PlayerClass)}
                      style={{ padding: "8px", fontSize: "16px" }}
                    >
                      <option value="warrior">Warrior</option>
                      <option value="ranger">Ranger</option>
                      <option value="mage">Mage</option>
                    </select>
                  ) : null}

                  <button type="submit" style={{ padding: "10px", fontSize: "16px", fontWeight: "bold" }}>
                    {props.authMode === "login" ? "Login" : "Create Account"}
                  </button>
                </form>

                <div
                  style={{
                    marginTop: "16px",
                    paddingTop: "16px",
                    borderTop: "1px solid rgba(255,255,255,0.2)"
                  }}
                >
                  <button
                    data-testid="guest-login-button"
                    onClick={props.onGuestLogin}
                    style={{ width: "100%", opacity: 0.7 }}
                  >
                    {i18n.t("auth.loginGuest")}
                  </button>
                </div>

                {props.error ? (
                  <div className="error">
                    {i18n.t("app.errorPrefix")}: {props.error}
                  </div>
                ) : null}
              </>
            )}
          </section>

          {props.showForgotPassword ? (
            <section
              className="authCard"
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                zIndex: 10,
                minWidth: "400px"
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "16px"
                }}
              >
                <h2 style={{ margin: 0 }}>Reset Password</h2>
                <button
                  onClick={props.onForgotPasswordClose}
                  style={{ background: "none", border: "none", fontSize: "24px", cursor: "pointer", padding: "0 8px" }}
                >
                  ×
                </button>
              </div>

              <p style={{ marginBottom: "16px" }}>
                Enter your email address and we'll send you a link to reset your password.
              </p>

              <form
                onSubmit={props.onForgotPasswordSubmit}
                style={{ display: "flex", flexDirection: "column", gap: "12px" }}
              >
                <input
                  type="email"
                  placeholder="Email"
                  value={props.forgotPasswordEmail}
                  onChange={(event) => props.onForgotPasswordEmailChange(event.target.value)}
                  required
                  style={{ padding: "8px", fontSize: "16px" }}
                />
                <button type="submit" style={{ padding: "10px", fontSize: "16px", fontWeight: "bold" }}>
                  Send Reset Link
                </button>
              </form>

              {props.forgotPasswordMessage ? (
                <div
                  style={{
                    marginTop: "12px",
                    padding: "8px",
                    background: "rgba(96, 165, 250, 0.2)",
                    borderRadius: "4px"
                  }}
                >
                  {props.forgotPasswordMessage}
                </div>
              ) : null}
            </section>
          ) : null}
        </section>
      </div>
    </main>
  );
}

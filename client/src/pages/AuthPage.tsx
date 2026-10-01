import type { FormEvent } from "react";
import { useState } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { setToken } from "../lib/auth";

type AuthMode = "login" | "signup";

type AuthPageProps = {
  mode: AuthMode;
};

function AuthPage({ mode }: AuthPageProps) {
  const isSignup = mode === "signup";
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!email.trim() || !password) {
      setError("Email and password are required.");
      return;
    }

    setError("");
    setIsSubmitting(true);

    try {
      const endpoint = isSignup ? "/users/signup" : "/users/login";
      const response = await api.post<{ token: string }>(endpoint, {
        email: email.trim(),
        password,
      });

      setToken(response.data.token);
      navigate("/dashboard", { replace: true });
    } catch (requestError) {
      const message = axios.isAxiosError(requestError)
        ? requestError.response?.data?.err ||
          requestError.response?.data?.message
        : "";

      setError(message || "Authentication failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleForgotPassword() {
    setError("Password reset is not available yet.");
  }

  return (
    <section className="auth-page">
      <p className="auth-brand">Spoonful</p>

      <h1>{isSignup ? "Create an Account" : "Welcome Back!"}</h1>

      <p className="auth-intro">
        {isSignup
          ? "Create an account to start sharing recipes"
          : "Log in to your account to continue"}
      </p>

      <form
        className={`auth-form${error ? " error-state" : ""}`}
        onSubmit={handleSubmit}
        noValidate
      >
        <label htmlFor="auth-email">Email</label>
        <input
          id="auth-email"
          type="email"
          placeholder="Email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />

        <label htmlFor="auth-password">Password</label>
        <input
          id="auth-password"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />

        {error && (
          <p className="auth-error" role="alert">
            {error}
          </p>
        )}

        {!isSignup && (
          <button
            className="forgot-password"
            type="button"
            onClick={handleForgotPassword}
          >
            Forgot Password?
          </button>
        )}

        <button className="auth-submit" type="submit" disabled={isSubmitting}>
          {isSubmitting
            ? "Please wait..."
            : isSignup
              ? "Create Account"
              : "Log in"}
        </button>
      </form>

      <Link
        className="auth-secondary-action"
        to={isSignup ? "/login" : "/signup"}
      >
        {isSignup ? "Log in" : "Create an Account"}
      </Link>

      <Link className="auth-guest-link" to="/recipes">
        Explore Recipes without Logging In
      </Link>
    </section>
  );
}

export default AuthPage;

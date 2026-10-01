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

  return (
    <section className="auth-page">
      <p className="eyebrow">Spoonful</p>
      <h1>{isSignup ? "Create an account" : "Log in"}</h1>
      <p className="auth-intro">
        {isSignup
          ? "Create an account to manage your recipes."
          : "Log in to manage your recipes."}
      </p>

      <form className="auth-form" onSubmit={handleSubmit}>
        <label htmlFor="auth-email">Email</label>
        <input
          id="auth-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />

        <label htmlFor="auth-password">Password</label>
        <input
          id="auth-password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />

        {error && (
          <p className="auth-error" role="alert">
            {error}
          </p>
        )}

        <button type="submit" disabled={isSubmitting}>
          {isSubmitting
            ? "Please wait..."
            : isSignup
              ? "Create account"
              : "Log in"}
        </button>
      </form>

      <p className="auth-switch">
        {isSignup ? "Already have an account?" : "Need an account?"}{" "}
        <Link to={isSignup ? "/login" : "/signup"}>
          {isSignup ? "Log in" : "Sign up"}
        </Link>
      </p>
    </section>
  );
}

export default AuthPage;

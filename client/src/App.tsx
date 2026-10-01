import type { ReactNode } from "react";
import { Link, NavLink, Navigate, Route, Routes } from "react-router-dom";
import "./App.css";

type PageProps = {
  title: string;
  description: string;
};

function PlaceholderPage({ title, description }: PageProps) {
  return (
    <section className="page-card">
      <p className="eyebrow">Spoonful</p>
      <h1>{title}</h1>
      <p>{description}</p>
    </section>
  );
}

function NavItem({ to, children }: { to: string; children: ReactNode }) {
  return (
    <NavLink
      className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
      to={to}
    >
      {children}
    </NavLink>
  );
}

function App() {
  return (
    <div className="app-shell">
      <header className="site-header">
        <Link className="brand" to="/recipes">
          Spoonful
        </Link>
        <nav className="site-nav" aria-label="Main navigation">
          <NavItem to="/recipes">Recipes</NavItem>
          <NavItem to="/dashboard">Dashboard</NavItem>
          <NavItem to="/ai-assistant">AI Assistant</NavItem>
          <NavItem to="/login">Log in</NavItem>
          <NavItem to="/signup">Sign up</NavItem>
        </nav>
      </header>

      <main className="site-main">
        <Routes>
          <Route path="/" element={<Navigate to="/recipes" replace />} />
          <Route
            path="/recipes"
            element={
              <PlaceholderPage
                title="Browse recipes"
                description="Search and explore recipes as a guest or signed-in user."
              />
            }
          />
          <Route
            path="/recipes/new"
            element={
              <PlaceholderPage
                title="Create a recipe"
                description="Add ingredients, instructions, tags, and an image link."
              />
            }
          />
          <Route
            path="/recipes/:id/edit"
            element={
              <PlaceholderPage
                title="Edit recipe"
                description="Update a recipe you created."
              />
            }
          />
          <Route
            path="/recipes/:id"
            element={
              <PlaceholderPage
                title="Recipe details"
                description="View the complete recipe."
              />
            }
          />
          <Route
            path="/dashboard"
            element={
              <PlaceholderPage
                title="Your dashboard"
                description="Manage recipes that you created."
              />
            }
          />
          <Route
            path="/login"
            element={
              <PlaceholderPage
                title="Log in"
                description="Authenticate to manage your recipes."
              />
            }
          />
          <Route
            path="/signup"
            element={
              <PlaceholderPage
                title="Create an account"
                description="Sign up to create and manage recipes."
              />
            }
          />
          <Route
            path="/ai-assistant"
            element={
              <PlaceholderPage
                title="AI Assistant"
                description="Ask questions and receive streamed responses."
              />
            }
          />
          <Route
            path="*"
            element={
              <PlaceholderPage
                title="Page not found"
                description="The requested page does not exist."
              />
            }
          />
        </Routes>
      </main>
    </div>
  );
}

export default App;

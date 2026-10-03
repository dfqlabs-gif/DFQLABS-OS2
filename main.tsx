import React from "react";
import ReactDOM from "react-dom/client";
import "./styles.css";

function App() {
  return (
    <main className="shell">
      <section className="card">
        <p className="eyebrow">DFQLABS OS 2.0</p>
        <h1>Lead Intelligence System</h1>
        <p>Foundation online. Feature implementation begins after bootstrap validation.</p>
      </section>
    </main>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode><App /></React.StrictMode>
);

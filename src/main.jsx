import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import App from "./App";

import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />

      <Toaster
        position="top-center"
        reverseOrder={false}
        toastOptions={{
          duration: 3000,
          style: {
            background: "#1e1b4b",
            color: "#fff",
            border: "1px solid rgba(255,255,255,.15)",
            borderRadius: "12px",
          },
        }}
      />
    </BrowserRouter>
  </React.StrictMode>
);
import { StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";
import Sandbox from "./sandbox";
import "./globals.css";

hydrateRoot(
  document.getElementById("root")!,
  <StrictMode>
    <Sandbox />
  </StrictMode>,
);

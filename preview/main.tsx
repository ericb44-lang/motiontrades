// Standalone preview: the same pages and components, rendered in the browser only,
// with hash-based URLs (#/browse) so the single HTML file works opened from disk.
import appCss from "../src/styles.css?inline";
import { StrictMode, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient } from "@tanstack/react-query";
import { RouterProvider, createHashHistory, createRouter } from "@tanstack/react-router";
import { routeTree } from "../src/routeTree.gen";
import { Route as rootRoute } from "../src/routes/__root";

// The real site's root route renders the full <html>/<body> document (server rendering).
// Here the page already exists, so render only the app inside #root.
(
  rootRoute.options as { shellComponent?: (p: { children: ReactNode }) => ReactNode }
).shellComponent = ({ children }) => children;

// Embed the stylesheet (the real site links it from the server-rendered <head>).
const style = document.createElement("style");
style.textContent = appCss;
document.head.appendChild(style);

const router = createRouter({
  routeTree,
  history: createHashHistory(),
  context: { queryClient: new QueryClient() },
  scrollRestoration: true,
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);

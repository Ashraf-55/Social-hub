"use client";

import { useEffect } from "react";

/**
 * Renders Swagger UI (from the CDN) against our own /api/docs/openapi
 * route, so /api-docs is a real, browsable API reference (Section 42)
 * rather than just a YAML file sitting in the repo.
 */
export default function ApiDocsPage() {
  useEffect(() => {
    const styleLink = document.createElement("link");
    styleLink.rel = "stylesheet";
    styleLink.href = "https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.17.14/swagger-ui.min.css";
    document.head.appendChild(styleLink);

    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.17.14/swagger-ui-bundle.min.js";
    script.onload = () => {
      // @ts-expect-error injected by the CDN bundle
      window.SwaggerUIBundle({ url: "/api/docs/openapi", dom_id: "#swagger-root" });
    };
    document.body.appendChild(script);

    return () => {
      document.head.removeChild(styleLink);
      document.body.removeChild(script);
    };
  }, []);

  return <div id="swagger-root" />;
}

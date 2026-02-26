"use client";

import SwaggerUI from "swagger-ui-react";
import "swagger-ui-react/swagger-ui.css";
import { useEffect, useState } from "react";

export default function ApiDocsPage() {
  const [spec, setSpec] = useState(null);

  useEffect(() => {
    fetch("/api/swagger")
      .then((res) => res.json())
      .then(setSpec);
  }, []);

  if (!spec) return <div style={{ padding: "2rem" }}>Loading API docs...</div>;

  return (
    <div style={{ padding: "1rem" }}>
      <SwaggerUI spec={spec} />
    </div>
  );
}
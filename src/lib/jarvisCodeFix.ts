export async function requestJarvisCodeFix(input: {
  title: string;
  description: string;
  targetFiles?: string[];
}) {
  const response = await fetch("/api/jarvis/code-fix", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Code fix request failed.");
  }

  return data as {
    ok: true;
    issueUrl: string;
  };
}

import { NextRequest, NextResponse } from "next/server";

type CodeFixRequest = {
  title: string;
  description: string;
  targetFiles?: string[];
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CodeFixRequest;

    if (!body.title || !body.description) {
      return NextResponse.json(
        { error: "Missing title or description." },
        { status: 400 }
      );
    }

    const repo = process.env.GITHUB_REPO;
    const owner = process.env.GITHUB_OWNER;
    const token = process.env.GITHUB_TOKEN;

    if (!repo || !owner || !token) {
      return NextResponse.json(
        { error: "GitHub integration is not configured." },
        { status: 500 }
      );
    }

    const issueBody = [
      "## Jarvis Code Fix Request",
      "",
      body.description,
      "",
      "## Target Files",
      "",
      body.targetFiles?.length
        ? body.targetFiles.map((file) => `- \`${file}\``).join("\n")
        : "- Not specified",
      "",
      "## Safety Rules",
      "",
      "- Do not auto-merge.",
      "- Do not edit secrets.",
      "- Do not modify Firestore rules without review.",
      "- Do not perform destructive database operations.",
    ].join("\n");

    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/issues`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: `[Jarvis Fix] ${body.title}`,
          body: issueBody,
          labels: ["jarvis", "code-fix", "needs-review"],
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: "GitHub issue creation failed.", details: errorText },
        { status: 500 }
      );
    }

    const issue = await response.json();

    return NextResponse.json({
      ok: true,
      issueUrl: issue.html_url,
    });
  } catch (error) {
    console.error("JARVIS CODE FIX ERROR:", error);

    return NextResponse.json(
      { error: "Jarvis code fix request failed." },
      { status: 500 }
    );
  }
}

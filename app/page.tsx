import { redirect } from "next/navigation";

export default function HomePage() {
  // 🔥 Single entry point for your app
  redirect("/dashboard");
}
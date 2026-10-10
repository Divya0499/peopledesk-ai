import { redirect } from "next/navigation";

// The assistant is the home page
export default function Home() {
  redirect("/chat");
}

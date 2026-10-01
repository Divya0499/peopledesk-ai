import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/session";

import ChatLayout from "./_components/ChatLayout";

// Checked on the server before anything renders, so a visitor without a
// valid session never sees the chat UI. This is the same check
// /api/auth/me makes.
async function Chat() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return <ChatLayout />;
}

export default Chat;

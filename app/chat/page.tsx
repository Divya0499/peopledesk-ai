import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/session";

import ChatLayout from "./_components/ChatLayout";

async function Chat() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  // Only hides the admin-only controls; the API routes still check the role
  return <ChatLayout isAdmin={user.role === "admin"} />;
}

export default Chat;

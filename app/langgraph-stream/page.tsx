import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/session";

import LangGraphStream from "./_components/LangGraphStream";

// Checked on the server before anything renders, so a visitor without a
// valid session never sees the stream UI. The UI itself is a client
// component, which can't read the session, so the check lives here.
async function LangGraphStreamPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return <LangGraphStream />;
}

export default LangGraphStreamPage;

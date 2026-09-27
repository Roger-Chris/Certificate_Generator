import Header from "@/components/Header";
import { listEvents } from "@/lib/templates";
import EditorClient from "./EditorClient";

export const dynamic = "force-static";

export default function EditorPage() {
  const events = listEvents();
  return (
    <>
      <Header crumbs={[{ label: "Template editor" }]} />
      <EditorClient events={events} />
    </>
  );
}
